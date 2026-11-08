import logging
import tempfile
from pathlib import Path

from secura.dependencies import scan_dependency_files
from secura.policy import evaluate_policy, load_policy
from secura.remediation import enrich_findings
from secura.sast import scan_file as scan_sast_file
from secura.secrets import scan_file as scan_secrets_file
from secura.pr_changes import is_scannable_file, DEPENDENCY_MANIFESTS, IGNORED_PARTS

logger = logging.getLogger("secura.github_app.pr_scanner")

SKIP_SECRET_FILES = {
    "secrets.py",
}

SKIP_SAST_FILES = {
    "sast.py",
    "remediation.py",
}


def scan_pull_request_files(
    directory: str,
    changed_files: list[dict],
):
    """Scan files changed in a GitHub pull request."""

    findings = []
    dependency_files = []

    root = Path(directory).resolve()

    for changed_file in changed_files:
        filename = changed_file.get("filename")

        if not filename:
            continue

        # Ignore deleted files because they no longer exist in the checkout
        if changed_file.get("status") == "removed":
            continue

        relative_path = Path(filename)

        # Avoid scanning ignored directories
        if any(part in IGNORED_PARTS for part in relative_path.parts):
            continue

        file_path = (root / relative_path).resolve()

        # Ensure the file remains inside the repository directory
        if root not in file_path.parents and file_path != root:
            continue

        if not file_path.is_file():
            continue

        # Identify dependency manifests
        if (
            relative_path.name in DEPENDENCY_MANIFESTS
            or relative_path.suffix.lower() == ".csproj"
        ):
            dependency_files.append(str(file_path))

        # Scan only supported source files
        if not is_scannable_file(relative_path):
            continue

        if relative_path.name not in SKIP_SECRET_FILES:
            findings.extend(scan_secrets_file(file_path))

        if relative_path.name not in SKIP_SAST_FILES:
            findings.extend(scan_sast_file(file_path))

    # Scan changed dependency manifests
    if dependency_files:
        findings.extend(
            scan_dependency_files(
                directory=str(root),
                files=dependency_files,
            )
        )

    # Normalize finding file paths to be relative to root
    relative_findings = []
    for f in findings:
        f_copy = dict(f)
        if "file" in f_copy:
            try:
                p = Path(f_copy["file"]).resolve()
                if p == root or root in p.parents:
                    f_copy["file"] = str(p.relative_to(root)).replace("\\", "/")
            except Exception:
                pass
        relative_findings.append(f_copy)

    # Evaluate findings using repository custom policy if present, else default
    repo_policy = root / "config" / "security-policy.yml"
    if repo_policy.is_file():
        policy = load_policy(str(repo_policy))
    else:
        policy = load_policy()

    result = evaluate_policy(relative_findings, policy)

    return {
        "result": result,
        "findings": enrich_findings(relative_findings),
    }


def scan_github_pull_request(
    changed_files: list[dict],
    fetch_file_content,
):
    """Scan GitHub PR files using a temporary directory."""

    with tempfile.TemporaryDirectory(prefix="secura-pr-") as temp_dir:
        root = Path(temp_dir).resolve()

        for changed_file in changed_files:
            filename = changed_file.get("filename")

            if not filename:
                continue

            # Deleted files do not need scanning
            if changed_file.get("status") == "removed":
                continue

            relative_path = Path(filename)

            # Ignore excluded directories
            if any(part in IGNORED_PARTS for part in relative_path.parts):
                continue

            # Ignore unsupported files
            is_dep = (
                relative_path.name in DEPENDENCY_MANIFESTS
                or relative_path.suffix.lower() == ".csproj"
            )
            if not is_scannable_file(relative_path) and not is_dep:
                continue

            destination = (root / relative_path).resolve()

            # Prevent paths from escaping the temporary directory
            if root not in destination.parents:
                continue

            # Retrieve the file content from GitHub safely
            try:
                content = fetch_file_content(filename)
                destination.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )
                destination.write_text(
                    content,
                    encoding="utf-8",
                    errors="replace",
                )
            except Exception as exc:
                logger.warning("Could not fetch file content for %s: %s", filename, exc)
                continue

        return scan_pull_request_files(
            directory=str(root),
            changed_files=changed_files,
        )
