from unittest.mock import Mock, call

import pytest

from secura import scanner
from secura.policy import DEFAULT_POLICY


@pytest.fixture
def cli_mocks(monkeypatch):
    mocks = {
        "scan_changed_files": Mock(return_value=[]),
        "scan_directory": Mock(return_value=[]),
        "get_changed_dependency_files": Mock(return_value=[]),
        "scan_dependency_files": Mock(return_value=[]),
        "load_policy": Mock(return_value=DEFAULT_POLICY.copy()),
        "generate_report": Mock(),
    }
    for name, mock in mocks.items():
        monkeypatch.setattr(scanner, name, mock)
    monkeypatch.setattr(scanner.sys, "argv", ["secura", "--changed"])
    return mocks


@pytest.mark.parametrize("manifest", ["requirements.txt", "web/package.json", "api/App.csproj"])
def test_changed_mode_scans_dependency_only_changes(monkeypatch, cli_mocks, manifest):
    # These manifests must be scanned even when no source files are selected.
    monkeypatch.setattr(scanner, "get_scannable_changed_files", Mock(return_value=[]))
    cli_mocks["get_changed_dependency_files"].return_value = [manifest]

    assert scanner.main() == 0

    cli_mocks["scan_changed_files"].assert_called_once_with(".")
    cli_mocks["get_changed_dependency_files"].assert_called_once_with()
    cli_mocks["scan_dependency_files"].assert_called_once_with(".", files=[manifest])
    cli_mocks["scan_directory"].assert_not_called()


@pytest.mark.parametrize("args", [["project", "--changed"], ["--changed", "project"]])
def test_changed_mode_passes_directory_and_only_selected_manifests(
    monkeypatch, cli_mocks, args
):
    manifests = ["requirements.txt", "web/package.json", "api/App.csproj"]
    monkeypatch.setattr(scanner.sys, "argv", ["secura", *args])
    cli_mocks["get_changed_dependency_files"].return_value = manifests

    assert scanner.main() == 0

    cli_mocks["scan_changed_files"].assert_called_once_with("project")
    cli_mocks["scan_dependency_files"].assert_called_once_with("project", files=manifests)
    cli_mocks["scan_directory"].assert_not_called()


def test_changed_mode_skips_dependency_scan_when_no_manifests_changed(cli_mocks, capsys):
    assert scanner.main() == 0

    cli_mocks["scan_dependency_files"].assert_not_called()
    cli_mocks["scan_directory"].assert_not_called()
    result, findings = cli_mocks["generate_report"].call_args.args
    assert findings == []
    assert result["passed"] is True
    assert result["score"] == 100
    assert "Scanning changed files only..." in capsys.readouterr().out


@pytest.mark.parametrize(("severity", "exit_code"), [("LOW", 0), ("HIGH", 1)])
def test_changed_mode_combines_findings_for_policy_and_report(
    cli_mocks, capsys, severity, exit_code
):
    source_finding = {
        "type": "Source issue", "severity": "LOW", "file": "app.py", "line": 2
    }
    dependency_finding = {
        "type": "Dependency Vulnerability",
        "severity": severity,
        "file": "requirements.txt",
        "line": 1,
    }
    cli_mocks["scan_changed_files"].return_value = [source_finding]
    cli_mocks["get_changed_dependency_files"].return_value = ["requirements.txt"]
    cli_mocks["scan_dependency_files"].return_value = [dependency_finding]

    assert scanner.main() == exit_code

    cli_mocks["generate_report"].assert_called_once()
    result, findings = cli_mocks["generate_report"].call_args.args
    assert findings == [source_finding, dependency_finding]
    assert result["passed"] is (exit_code == 0)
    assert result["counts"][severity] == (2 if severity == "LOW" else 1)
    output = capsys.readouterr().out
    assert "2 finding(s) detected" in output
    assert f"[{severity}] Dependency Vulnerability -> requirements.txt:1" in output
    assert ("SECURITY GATE: PASSED" if exit_code == 0 else "SECURITY GATE: FAILED") in output


def test_changed_mode_reports_dependency_findings_without_line_numbers(cli_mocks):
    # scan_dependency returns manifest-level findings with no `line` field.
    cli_mocks["get_changed_dependency_files"].return_value = ["requirements.txt"]
    cli_mocks["scan_dependency_files"].return_value = [{
        "type": "Dependency Vulnerability",
        "severity": "HIGH",
        "file": "requirements.txt",
        "package": "example",
        "version": "1.0.0",
        "ecosystem": "PyPI",
        "vulnerability_id": "TEST-001",
        "summary": "Synthetic vulnerability",
    }]

    assert scanner.main() == 1


def test_changed_mode_propagates_manifest_discovery_failure(cli_mocks):
    cli_mocks["get_changed_dependency_files"].side_effect = RuntimeError("Missing base")

    with pytest.raises(RuntimeError, match="Missing base"):
        scanner.main()

    cli_mocks["scan_dependency_files"].assert_not_called()
    cli_mocks["generate_report"].assert_not_called()


def test_full_mode_scans_all_dependencies(monkeypatch, cli_mocks, capsys):
    monkeypatch.setattr(scanner.sys, "argv", ["secura", "project"])
    source = {"type": "Source issue", "severity": "LOW", "file": "app.py", "line": 1}
    dependency = {
        "type": "Dependency Vulnerability", "severity": "LOW",
        "file": "package.json", "line": 1,
    }
    cli_mocks["scan_directory"].return_value = [source]
    cli_mocks["scan_dependency_files"].return_value = [dependency]

    assert scanner.main() == 0

    cli_mocks["scan_directory"].assert_called_once_with("project")
    cli_mocks["scan_dependency_files"].assert_called_once_with("project")
    cli_mocks["scan_changed_files"].assert_not_called()
    cli_mocks["get_changed_dependency_files"].assert_not_called()
    assert cli_mocks["generate_report"].call_args.args[1] == [source, dependency]
    assert "Scanning the full repository..." in capsys.readouterr().out


@pytest.mark.parametrize("changed_only", [False, True])
def test_source_scans_aggregate_findings_and_skip_sast_self_scan(
    monkeypatch, tmp_path, changed_only
):
    source = tmp_path / "app.py"
    sast_source = tmp_path / "sast.py"
    source.touch()
    sast_source.touch()
    secret_findings = {source: [{"type": "Secret"}], sast_source: [{"type": "SAST secret"}]}
    sast_findings = [{"type": "SQL Injection"}, {"type": "Command Injection"}]
    secrets = Mock(side_effect=lambda path: secret_findings[path])
    sast = Mock(return_value=sast_findings)
    monkeypatch.setattr(scanner, "scan_secrets", secrets)
    monkeypatch.setattr(scanner, "scan_sast", sast)
    changed_files = Mock(return_value=["app.py", "sast.py"])
    monkeypatch.setattr(scanner, "get_scannable_changed_files", changed_files)

    if changed_only:
        findings = scanner.scan_changed_files(tmp_path, "origin/release")
        changed_files.assert_called_once_with("origin/release")
    else:
        findings = scanner.scan_directory(tmp_path)
        changed_files.assert_not_called()

    assert sorted(finding["type"] for finding in findings) == [
        "Command Injection", "SAST secret", "SQL Injection", "Secret"
    ]
    assert secrets.call_count == 2
    secrets.assert_has_calls([call(source), call(sast_source)], any_order=True)
    sast.assert_called_once_with(source)


def test_changed_source_scan_rejects_paths_outside_root_and_non_files(monkeypatch, tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "outside.py"
    outside.touch()
    (root / "escape.py").symlink_to(outside)
    (root / "directory.py").mkdir()
    valid = root / "app.py"
    valid.touch()
    monkeypatch.setattr(scanner, "get_scannable_changed_files", Mock(return_value=[
        "../outside.py", str(outside), "escape.py", "missing.py", "directory.py", "app.py"
    ]))
    secrets = Mock(return_value=[])
    sast = Mock(return_value=[])
    monkeypatch.setattr(scanner, "scan_secrets", secrets)
    monkeypatch.setattr(scanner, "scan_sast", sast)

    assert scanner.scan_changed_files(root) == []

    secrets.assert_called_once_with(valid)
    sast.assert_called_once_with(valid)
