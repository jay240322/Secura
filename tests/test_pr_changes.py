import runpy
import subprocess
from unittest.mock import Mock

import pytest

from secura import pr_changes


@pytest.mark.parametrize(
    "filename",
    [
        "requirements.txt",
        "backend/requirements.txt",
        "package.json",
        "frontend/package.json",
        "Service.csproj",
        "src/Service.CSPROJ",
        "src/Service.CsPrOj",
        "project with spaces/requirements.txt",
    ],
)
def test_changed_dependency_files_accept_supported_manifests(monkeypatch, filename):
    changed_files = Mock(return_value=[filename])
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    assert pr_changes.get_changed_dependency_files("origin/release") == [filename]
    changed_files.assert_called_once_with("origin/release")


@pytest.mark.parametrize("ignored", [".git", ".venv", "__pycache__", "tests"])
@pytest.mark.parametrize("manifest", ["requirements.txt", "package.json", "App.csproj"])
def test_changed_dependency_files_ignore_excluded_path_parts(
    monkeypatch, ignored, manifest
):
    monkeypatch.setattr(
        pr_changes,
        "get_changed_files",
        Mock(return_value=[f"{ignored}/{manifest}", f"src/{ignored}/{manifest}"]),
    )

    assert pr_changes.get_changed_dependency_files() == []


def test_changed_dependency_files_match_exact_names_and_path_parts(monkeypatch):
    supported = [
        "tests-support/requirements.txt",
        "contest/package.json",
        ".venv-backup/App.csproj",
    ]
    unsupported = [
        "app.py",
        "config.json",
        "requirements-dev.txt",
        "requirements.txt.bak",
        "package-lock.json",
        "Package.json",
        "Requirements.txt",
        "App.csproj.bak",
        "requirements.txt/app.py",
        "package.json/config.yaml",
    ]
    monkeypatch.setattr(
        pr_changes, "get_changed_files", Mock(return_value=unsupported + supported)
    )

    assert pr_changes.get_changed_dependency_files() == supported


def test_changed_dependency_files_preserve_order_and_forward_default_base(monkeypatch):
    manifests = ["web/package.json", "api/App.csproj", "requirements.txt"]
    changed_files = Mock(return_value=[manifests[0], "app.py", *manifests[1:]])
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    assert pr_changes.get_changed_dependency_files() == manifests
    changed_files.assert_called_once_with("origin/main")


def test_changed_dependency_files_handle_empty_diff(monkeypatch):
    monkeypatch.setattr(pr_changes, "get_changed_files", Mock(return_value=[]))

    assert pr_changes.get_changed_dependency_files() == []


def test_changed_dependency_files_propagate_comparison_failure(monkeypatch):
    monkeypatch.setattr(
        pr_changes,
        "get_changed_files",
        Mock(side_effect=RuntimeError("Could not compare HEAD with missing-base")),
    )

    with pytest.raises(RuntimeError, match="missing-base"):
        pr_changes.get_changed_dependency_files("missing-base")


def test_dependency_discovery_includes_manifests_excluded_from_source_scan(monkeypatch):
    monkeypatch.setattr(
        pr_changes,
        "get_changed_files",
        Mock(return_value=["app.py", "requirements.txt", "App.csproj", "package.json"]),
    )

    assert pr_changes.get_scannable_changed_files() == ["app.py", "package.json"]
    assert pr_changes.get_changed_dependency_files() == [
        "requirements.txt", "App.csproj", "package.json"
    ]


@pytest.mark.parametrize(
    ("changed_files", "expected_lines"),
    [
        ([], []),
        (
            ["app.py", "requirements.txt", "App.csproj", "package.json", "tests/package.json"],
            [
                "app.py",
                "package.json",
                "Dependency manifest: requirements.txt",
                "Dependency manifest: App.csproj",
                "Dependency manifest: package.json",
            ],
        ),
    ],
)
def test_module_output_labels_dependency_manifests(
    monkeypatch, capsys, changed_files, expected_lines
):
    # Exercise the script entry point without launching Git or another process.
    diff = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="".join(f"{name}\0" for name in changed_files)
    )
    monkeypatch.setattr(subprocess, "run", Mock(return_value=diff))

    runpy.run_path(pr_changes.__file__, run_name="__main__")

    assert capsys.readouterr().out.splitlines() == expected_lines
