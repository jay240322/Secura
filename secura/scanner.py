
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
)


def scan_directory(directory):
    """Return secret and SAST findings from supported files under ``directory``.

    Recurse into subdirectories, skipping paths containing ``.git``, ``.venv``,
    ``__pycache__``, or ``tests`` and files with unsupported suffixes. Files named
    ``sast.py`` receive only the secret scan. Each finding contains its type,
    severity, file path, and 1-based line number. File read errors contribute
    no findings from the affected scanner; SAST also skips invalid UTF-8.
    """
    all_findings = []

    allowed_extensions = {
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cs", ".php", ".go",
        ".rb", ".cpp", ".c", ".h", ".json", ".yaml", ".yml", ".xml", ".env",
        ".ini", ".config", ".properties", ".toml",
    }

    for path in Path(directory).rglob("*"):
        if not path.is_file():
            continue

        if any(
            part in {".git", ".venv", "__pycache__", "tests"}
            for part in path.parts
        ):
            continue

        if path.suffix.lower() not in allowed_extensions:
            continue

        all_findings.extend(scan_secrets(path))

        if path.name != "sast.py":
            all_findings.extend(scan_sast(path))

    return all_findings


def scan_changed_files(directory=".", base_ref="origin/main"):
    """Return secret and SAST findings for supported changed source files.

    Select added, copied, modified, and renamed files between the merge base
    with ``base_ref`` and HEAD in the current working directory's repository.
    Uncommitted changes are excluded from selection, but current file contents
    are scanned. Resolve selected paths under ``directory`` and skip missing
    files and paths resolving outside it. The source-file filters and scanner
    exclusions match ``scan_directory``; finding paths are absolute.

    File read errors contribute no findings from the affected scanner; SAST
    also skips invalid UTF-8. Git comparison failures raise RuntimeError;
    errors starting Git and resolving paths propagate.
    """
    root = Path(directory).resolve()
    all_findings = []

    for filename in get_scannable_changed_files(base_ref):
        path = (root / filename).resolve()

        # Prevent paths from escaping the selected project directory.
        if not path.is_relative_to(root):
            continue

        if not path.is_file():
            continue

        all_findings.extend(scan_secrets(path))

        if path.name != "sast.py":
            all_findings.extend(scan_sast(path))

    return all_findings


def main():
    """Run the CLI scan using ``sys.argv`` and return the security gate status.

    Scan the first argument not starting with ``--`` as a directory, defaulting
    to ``.``. With ``--changed``, select source files and dependency manifests
    changed since the merge base of ``origin/main`` and HEAD in the current
    working directory's repository. Changed source paths are resolved under
    the selected directory; changed manifest paths use the working directory.

    Query OSV for dependency vulnerabilities, load ``config/security-policy.yml``
    (or defaults if absent), overwrite ``secura-report.json``, and print results.
    Policy and report paths are relative to the working directory. Return 0
    when the policy passes or 1 when it fails. Caught OSV HTTP, URL, and timeout
    errors yield no dependency findings for that query.

    Git, dependency/policy parsing, and report-writing errors propagate. Printing
    a finding without a ``line`` key (including dependency findings) raises
    KeyError after the report is written instead of returning a gate status.
    """
    args = sys.argv[1:]
    changed_mode = "--changed" in args

    # Support an optional directory argument without treating flags as paths.
    directory_args = [arg for arg in args if not arg.startswith("--")]
    directory = directory_args[0] if directory_args else "."

    print("=" * 50)
    print("           SECURA SECURITY SCAN")
    print("=" * 50)

    if changed_mode:
        print("Scanning changed files only...")

        findings = scan_changed_files(directory)

        # Scan changed dependency manifests separately.
        dependency_files = get_changed_dependency_files()

        if dependency_files:
            dependency_findings = scan_dependency_files(
                directory,
                files=dependency_files,
            )
            findings.extend(dependency_findings)

    else:
        print("Scanning the full repository...")

        findings = scan_directory(directory)

        dependency_findings = scan_dependency_files(directory)
        findings.extend(dependency_findings)

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
                f"-> {finding['file']}:{finding['line']}"
            )

    if result["passed"]:
        print("\n✓ SECURITY GATE: PASSED")
        return 0

    print("\n✗ SECURITY GATE: FAILED")

    if result["failures"]:
        print("\nPolicy violations:")
        for failure in result["failures"]:
            print(f"  - {failure}")

    return 1
if __name__ == "__main__":
    sys.exit(main())