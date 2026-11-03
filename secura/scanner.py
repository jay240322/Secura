import os
import sys
from pathlib import Path

from secura.policy import evaluate_policy, load_policy
from secura.secrets import scan_file as scan_secrets
from secura.sast import scan_file as scan_sast
from secura.dependencies import scan_dependency_files
from secura.report import generate_report
from secura.pr_changes import (
    get_scannable_changed_files,
    get_changed_dependency_files,
    is_scannable_file,
)


SKIP_DIRECTORIES = {
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "tests",
    "node_modules",
    ".next",
}

SKIP_FILES = {
    "secura-report.json",
}

SKIP_SECRET_FILES = {
    "secrets.py",
}

SKIP_SAST_FILES = {
    "sast.py",
    "remediation.py",
}


def should_skip_path(path: Path) -> bool:
    """Check whether a path should be excluded from scanning."""
    if path.name in SKIP_FILES:
        return True

    if any(part in SKIP_DIRECTORIES for part in path.parts):
        return True

    return False


def scan_directory(directory="."):
    """Scan supported files for secrets and SAST findings efficiently."""
    root = Path(directory).resolve()
    all_findings = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune ignored and hidden directories so os.walk does not descend into them
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRECTORIES and not (d.startswith(".") and d not in {".secrets"})
        ]

        for filename in filenames:
            path = Path(dirpath) / filename

            if should_skip_path(path):
                continue

            if not is_scannable_file(path):
                continue

            # Scan for secrets in supported files
            if path.name not in SKIP_SECRET_FILES:
                all_findings.extend(scan_secrets(path))

            # Avoid scanning Secura's own rules and remediation examples
            if path.name not in SKIP_SAST_FILES:
                all_findings.extend(scan_sast(path))

    return all_findings


def scan_changed_files(directory=".", base_ref="origin/main"):
    """Scan supported files changed relative to the base branch."""
    root = Path(directory).resolve()
    all_findings = []

    for filename in get_scannable_changed_files(base_ref):
        path = (root / filename).resolve()

        # Prevent paths from escaping the selected project directory
        if not path.is_relative_to(root):
            continue

        if not path.is_file():
            continue

        if should_skip_path(path):
            continue

        if not is_scannable_file(path):
            continue

        # Scan for secrets in changed files
        if path.name not in SKIP_SECRET_FILES:
            all_findings.extend(scan_secrets(path))

        # Apply the same SAST exclusions as full-repository scanning
        if path.name not in SKIP_SAST_FILES:
            all_findings.extend(scan_sast(path))

    return all_findings


def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    args = sys.argv[1:]
    changed_mode = "--changed" in args

    # Support an optional directory without treating flags as paths
    directory_args = [
        arg for arg in args if not arg.startswith("--")
    ]
    directory = directory_args[0] if directory_args else "."

    print("=" * 60)
    print("                 SECURA SECURITY SCAN")
    print("=" * 60)

    if changed_mode:
        print("Mode: Scanning changed files relative to base branch...")

        findings = scan_changed_files(directory)

        # Scan changed dependency manifests separately
        dependency_files = get_changed_dependency_files()

        if dependency_files:
            dependency_findings = scan_dependency_files(
                directory,
                files=dependency_files,
            )
            findings.extend(dependency_findings)

    else:
        print("Mode: Scanning full repository...")

        findings = scan_directory(directory)

        dependency_findings = scan_dependency_files(directory)
        findings.extend(dependency_findings)

    # Evaluate findings and generate the JSON report
    policy = load_policy()
    result = evaluate_policy(findings, policy)
    generate_report(result, findings)

    print("\nSecurity Summary")
    print("-" * 30)

    print(f"Critical : {result['counts']['CRITICAL']}")
    print(f"High     : {result['counts']['HIGH']}")
    print(f"Medium   : {result['counts']['MEDIUM']}")
    print(f"Low      : {result['counts']['LOW']}")

    print(f"\nSecurity Score: {result['score']}/100")

    if findings:
        print(f"\n⚠ {len(findings)} finding(s) detected:\n")

        for finding in findings:
            print(
                f"[{finding.get('severity', 'MEDIUM')}] "
                f"{finding['type']} "
                f"-> {finding['file']}:{finding.get('line', '?')}"
            )

    has_violations = not result["passed"] or len(findings) > 0 and (
        result["counts"]["CRITICAL"] > 0 or result["counts"]["HIGH"] > 0
    )

    if not has_violations and result["passed"]:
        print("\n" + "=" * 60)
        print("  ✅ SECURITY GATE: PASSED - SAFE TO MERGE")
        print("=" * 60)
        return 0

    print("\n" + "=" * 60)
    print("  ❌ SECURITY GATE: FAILED - UNSAFE TO MERGE")
    print("  Do NOT merge this branch into main!")
    print("  Potential secrets or policy violations were detected.")
    print("=" * 60)

    if result["failures"]:
        print("\nPolicy violations:")
        for failure in result["failures"]:
            print(f"  - {failure}")

    return 1


if __name__ == "__main__":
    sys.exit(main())
