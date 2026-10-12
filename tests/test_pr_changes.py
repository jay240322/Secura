import runpy
import subprocess
from unittest.mock import Mock

import pytest

from secura import pr_changes


def test_changed_dependency_files_preserves_supported_paths_and_order(monkeypatch):
    manifests = [
        "requirements.txt",
        "backend/requirements.txt",
        "package.json",
        "web client/package.json",
        "Service.csproj",
        "services/My App.CsPrOj",
    ]
    changed_files = Mock(return_value=["app.py", *manifests, "README.md"])
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    assert pr_changes.get_changed_dependency_files() == manifests
    changed_files.assert_called_once_with("origin/main")


@pytest.mark.parametrize("ignored", [".git", ".venv", "__pycache__", "tests"])
@pytest.mark.parametrize("manifest", ["requirements.txt", "package.json", "App.csproj"])
def test_changed_dependency_files_excludes_ignored_path_components(
    monkeypatch, ignored, manifest
):
    changed_files = Mock(
        return_value=[f"{ignored}/{manifest}", f"src/{ignored}/nested/{manifest}"]
    )
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    assert pr_changes.get_changed_dependency_files() == []


def test_changed_dependency_files_does_not_ignore_similar_directory_names(monkeypatch):
    manifests = [
        "tests-app/package.json",
        ".github/requirements.txt",
        ".venv-backup/App.csproj",
        "__pycache__-backup/requirements.txt",
    ]
    monkeypatch.setattr(pr_changes, "get_changed_files", Mock(return_value=manifests))

    assert pr_changes.get_changed_dependency_files() == manifests


def test_changed_dependency_files_rejects_unsupported_and_lookalike_names(monkeypatch):
    filenames = [
        "requirements-dev.txt",
        "requirements.txt.bak",
        "myrequirements.txt",
        "package-lock.json",
        "package.json.old",
        "notpackage.json",
        "pyproject.toml",
        "App.csproj.user",
        "App.fsproj",
        "app.py",
        "Requirements.txt",
        "Package.json",
    ]
    monkeypatch.setattr(pr_changes, "get_changed_files", Mock(return_value=filenames))

    assert pr_changes.get_changed_dependency_files() == []


def test_changed_dependency_files_forwards_custom_base_for_empty_diff(monkeypatch):
    changed_files = Mock(return_value=[])
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    assert pr_changes.get_changed_dependency_files("origin/release") == []
    changed_files.assert_called_once_with("origin/release")


def test_changed_dependency_files_propagates_comparison_failure(monkeypatch):
    changed_files = Mock(side_effect=RuntimeError("Cannot compare base branch"))
    monkeypatch.setattr(pr_changes, "get_changed_files", changed_files)

    with pytest.raises(RuntimeError, match="Cannot compare base branch"):
        pr_changes.get_changed_dependency_files("missing-base")


@pytest.mark.parametrize(
    ("filenames", "expected_lines"),
    [
        (
            ["app.py", "requirements.txt", "service/App.csproj", "web/package.json"],
            [
                "app.py",
                "web/package.json",
                "Dependency manifest: requirements.txt",
                "Dependency manifest: service/App.csproj",
                "Dependency manifest: web/package.json",
            ],
        ),
        (["tests/requirements.txt", "README.md"], []),
    ],
)
def test_pr_changes_command_labels_dependency_manifests(
    monkeypatch, capsys, filenames, expected_lines
):
    result = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="\0".join(filenames) + "\0"
    )
    monkeypatch.setattr(subprocess, "run", Mock(return_value=result))

    runpy.run_path(str(pr_changes.__file__), run_name="__main__")

    assert capsys.readouterr().out.splitlines() == expected_lines
