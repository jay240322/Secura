from unittest.mock import Mock, call

import pytest

from secura import scanner


@pytest.mark.parametrize("changed_only", [False, True], ids=["directory", "changed"])
def test_source_scans_combine_findings_and_skip_sast_self_scan(
    monkeypatch, tmp_path, changed_only
):
    app = tmp_path / "app.py"
    sast = tmp_path / "sast.py"
    app.write_text("", encoding="utf-8")
    sast.write_text("", encoding="utf-8")
    secrets = {
        app: [{"type": "App secret"}, {"type": "Another app secret"}],
        sast: [{"type": "SAST module secret"}],
    }
    secret_scan = Mock(side_effect=lambda path: secrets[path])
    sast_scan = Mock(return_value=[{"type": "SQL Injection"}])
    monkeypatch.setattr(scanner, "scan_secrets", secret_scan)
    monkeypatch.setattr(scanner, "scan_sast", sast_scan)
    changed_files = Mock(return_value=["app.py", "sast.py"])
    monkeypatch.setattr(scanner, "get_scannable_changed_files", changed_files)

    if changed_only:
        findings = scanner.scan_changed_files(tmp_path, base_ref="origin/release")
        changed_files.assert_called_once_with("origin/release")
    else:
        findings = scanner.scan_directory(tmp_path)
        changed_files.assert_not_called()

    assert sorted(finding["type"] for finding in findings) == [
        "Another app secret",
        "App secret",
        "SAST module secret",
        "SQL Injection",
    ]
    assert secret_scan.call_count == 2
    secret_scan.assert_has_calls([call(app), call(sast)], any_order=True)
    sast_scan.assert_called_once_with(app)


def test_changed_scan_ignores_missing_files_directories_and_escaping_paths(
    monkeypatch, tmp_path
):
    root = tmp_path / "project"
    root.mkdir()
    (root / "directory.py").mkdir()
    outside = tmp_path / "outside.py"
    outside.write_text("", encoding="utf-8")
    sibling = tmp_path / "project-other"
    sibling.mkdir()
    (sibling / "app.py").write_text("", encoding="utf-8")
    (root / "linked.py").symlink_to(outside)
    safe = root / "safe.py"
    safe.write_text("", encoding="utf-8")
    monkeypatch.setattr(
        scanner,
        "get_scannable_changed_files",
        Mock(return_value=[
            "missing.py",
            "directory.py",
            "../outside.py",
            str(outside),
            "../project-other/app.py",
            "linked.py",
            "safe.py",
        ]),
    )
    secret_scan = Mock(return_value=[])
    sast_scan = Mock(return_value=[])
    monkeypatch.setattr(scanner, "scan_secrets", secret_scan)
    monkeypatch.setattr(scanner, "scan_sast", sast_scan)

    assert scanner.scan_changed_files(root) == []
    secret_scan.assert_called_once_with(safe)
    sast_scan.assert_called_once_with(safe)


def test_changed_scan_with_no_source_changes_does_not_invoke_scanners(monkeypatch):
    monkeypatch.setattr(scanner, "get_scannable_changed_files", Mock(return_value=[]))
    secret_scan = Mock()
    sast_scan = Mock()
    monkeypatch.setattr(scanner, "scan_secrets", secret_scan)
    monkeypatch.setattr(scanner, "scan_sast", sast_scan)

    assert scanner.scan_changed_files() == []
    secret_scan.assert_not_called()
    sast_scan.assert_not_called()


@pytest.fixture
def main_dependencies(monkeypatch):
    """Isolate CLI routing from filesystem scans, policy files, and report writes."""
    result = {
        "passed": True,
        "score": 100,
        "counts": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "failures": [],
    }
    replacements = {
        "scan_changed_files": Mock(return_value=[]),
        "scan_directory": Mock(return_value=[]),
        "get_changed_dependency_files": Mock(return_value=[]),
        "get_scannable_changed_files": Mock(
            side_effect=AssertionError("Manifest selection must be independent of source files")
        ),
        "scan_dependency_files": Mock(return_value=[]),
        "load_policy": Mock(return_value={"max_high": 0}),
        "evaluate_policy": Mock(return_value=result),
        "generate_report": Mock(),
    }
    for name, replacement in replacements.items():
        monkeypatch.setattr(scanner, name, replacement)
    return replacements


@pytest.mark.parametrize("manifest", ["requirements.txt", "web/package.json", "App.csproj"])
def test_changed_mode_scans_manifests_even_without_source_changes(
    monkeypatch, capsys, main_dependencies, manifest
):
    monkeypatch.setattr(scanner.sys, "argv", ["secura", "--changed"])
    dependencies = main_dependencies
    finding = {
        "type": "Dependency Vulnerability",
        "severity": "HIGH",
        "file": manifest,
        "line": 0,
    }
    dependencies["get_changed_dependency_files"].return_value = [manifest]
    dependencies["scan_dependency_files"].return_value = [finding]
    result = {
        "passed": False,
        "score": 80,
        "counts": {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 0, "LOW": 0},
        "failures": ["High findings: 1 (maximum allowed: 0)"],
    }
    dependencies["evaluate_policy"].return_value = result

    assert scanner.main() == 1

    dependencies["scan_changed_files"].assert_called_once_with(".")
    dependencies["get_changed_dependency_files"].assert_called_once_with()
    dependencies["scan_dependency_files"].assert_called_once_with(".", files=[manifest])
    dependencies["scan_directory"].assert_not_called()
    dependencies["evaluate_policy"].assert_called_once_with(
        [finding], dependencies["load_policy"].return_value
    )
    dependencies["generate_report"].assert_called_once_with(result, [finding])
    output = capsys.readouterr().out
    assert "Scanning changed files only..." in output
    assert f"[HIGH] Dependency Vulnerability -> {manifest}:0" in output
    assert "SECURITY GATE: FAILED" in output
    assert result["failures"][0] in output


@pytest.mark.parametrize("has_source_findings", [False, True])
def test_changed_mode_without_manifests_skips_dependency_scan(
    monkeypatch, capsys, main_dependencies, has_source_findings
):
    monkeypatch.setattr(scanner.sys, "argv", ["secura", "--changed"])
    findings = (
        [{"type": "Weak Hash", "severity": "LOW", "file": "app.py", "line": 1}]
        if has_source_findings else []
    )
    dependencies = main_dependencies
    dependencies["scan_changed_files"].return_value = findings.copy()

    assert scanner.main() == 0

    dependencies["scan_dependency_files"].assert_not_called()
    dependencies["scan_directory"].assert_not_called()
    dependencies["evaluate_policy"].assert_called_once_with(
        findings, dependencies["load_policy"].return_value
    )
    dependencies["generate_report"].assert_called_once_with(
        dependencies["evaluate_policy"].return_value, findings
    )
    assert "SECURITY GATE: PASSED" in capsys.readouterr().out


@pytest.mark.parametrize(
    "arguments",
    [["project", "--changed"], ["--changed", "project"]],
)
def test_changed_mode_combines_source_and_manifest_findings_for_selected_directory(
    monkeypatch, main_dependencies, arguments
):
    monkeypatch.setattr(scanner.sys, "argv", ["secura", *arguments])
    dependencies = main_dependencies
    source = {"type": "Secret", "severity": "HIGH", "file": "app.py", "line": 1}
    dependency = {
        "type": "Dependency Vulnerability",
        "severity": "LOW",
        "file": "requirements.txt",
        "line": 0,
    }
    manifests = ["requirements.txt", "web/package.json", "App.csproj"]
    dependencies["scan_changed_files"].return_value = [source]
    dependencies["get_changed_dependency_files"].return_value = manifests
    dependencies["scan_dependency_files"].return_value = [dependency]

    scanner.main()

    dependencies["scan_changed_files"].assert_called_once_with("project")
    dependencies["scan_dependency_files"].assert_called_once_with("project", files=manifests)
    dependencies["scan_directory"].assert_not_called()
    dependencies["evaluate_policy"].assert_called_once_with(
        [source, dependency], dependencies["load_policy"].return_value
    )
    dependencies["generate_report"].assert_called_once_with(
        dependencies["evaluate_policy"].return_value, [source, dependency]
    )


def test_full_mode_keeps_repository_wide_dependency_scan(monkeypatch, main_dependencies):
    monkeypatch.setattr(scanner.sys, "argv", ["secura", "project"])
    dependencies = main_dependencies
    source = {"type": "Secret", "file": "app.py", "line": 1}
    dependency = {"type": "Dependency Vulnerability", "file": "package.json", "line": 0}
    dependencies["scan_directory"].return_value = [source]
    dependencies["scan_dependency_files"].return_value = [dependency]

    scanner.main()

    dependencies["scan_directory"].assert_called_once_with("project")
    dependencies["scan_dependency_files"].assert_called_once_with("project")
    dependencies["scan_changed_files"].assert_not_called()
    dependencies["get_changed_dependency_files"].assert_not_called()
    dependencies["evaluate_policy"].assert_called_once_with(
        [source, dependency], dependencies["load_policy"].return_value
    )
    dependencies["generate_report"].assert_called_once_with(
        dependencies["evaluate_policy"].return_value, [source, dependency]
    )
