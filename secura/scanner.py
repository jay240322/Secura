import sys
from pathlib import Path

from secura.policy import evaluate_policy, load_policy
from secura.secrets import scan_file as scan_secrets
from secura.sast import scan_file as scan_sast
from secura.dependencies import scan_dependency_files
from secura.report import generate_report
from secura.pr_changes import get_scannable_changed_files


def scan_directory(directory):
    """Scan the entire directory for secrets and SAST findings."""
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

        secret_findings = scan_secrets(path)
        all_findings.extend(secret_findings)

        if path.name != "sast.py":
            sast_findings = scan_sast(path)
            all_findings.extend(sast_findings)

    return all_findings


def scan_changed_files(directory=".", base_ref="origin/main"):
    """Scan supported files changed relative to the base branch."""
    root = Path(directory).resolve()
    all_findings = []

    for filename in get_scannable_changed_files(base_ref):
        path = (root / filename).resolve()

        if not path.is_relative_to(root):
            continue

        if not path.is_file():
            continue

        secret_findings = scan_secrets(path)
        all_findings.extend(secret_findings)

        if path.name != "sast.py":
            sast_findings = scan_sast(path)
            all_findings.extend(sast_findings)

    return all_findings


def main():
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

        changed_files = get_scannable_changed_files()

        dependency_files = [
            filename
            for filename in changed_files
            if Path(filename).name in {"requirements.txt", "package.json"}
            or filename.endswith(".csproj")
        ]

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