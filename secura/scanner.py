
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

    Recurse through files with supported extensions, excluding paths containing
    ``.git``, ``.venv``, ``__pycache__``, or ``tests``. Files named ``sast.py``
    receive only the secret scan. No dependency vulnerability scan is performed.
    Unreadable files contribute no findings; SAST also skips invalid UTF-8,
    while the secret scan ignores undecodable bytes.
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
    """Return secret and SAST findings from supported changed files.

    Use the current working directory's Git repository to compare HEAD with
    its merge base with ``base_ref``, excluding uncommitted changes and
    deletions. Resolve the returned paths under ``directory``; skip paths
    outside that resolved root, missing files, unsupported extensions, and
    paths containing ``.git``, ``.venv``, ``__pycache__``, or ``tests``.
    Files named ``sast.py`` receive only the secret scan. Unreadable files
    contribute no findings; SAST also skips invalid UTF-8, while the secret
    scan ignores undecodable bytes. Dependencies are not scanned here.

    Propagate RuntimeError if Git cannot perform the comparison, or OSError
    if Git cannot be started. Path resolution errors also propagate.
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
    """Run the CLI scan and return 0 for a passing policy gate, otherwise 1.

    Read ``sys.argv`` for an optional directory (default ``.``) and ``--changed``.
    Scan source files and dependencies; changed mode selects committed changes
    since the merge base of HEAD and ``origin/main`` in the current working
    directory's repository. Changed source paths are resolved under the chosen
    directory, but changed dependency paths are relative to the working directory.

    Query OSV for dependencies, load ``config/security-policy.yml`` from the
    working directory (using defaults if absent), overwrite ``secura-report.json``
    there, and print findings and the policy result.

    Git, dependency parsing, policy loading/evaluation, and report writing errors
    propagate instead of returning a gate status. Caught OSV HTTP, URL, and
    timeout errors yield no dependency findings for the affected query.
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