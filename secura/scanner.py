import sys
from pathlib import Path

from secura.policy import evaluate_policy, load_policy
from secura.secrets import scan_file as scan_secrets
from secura.sast import scan_file as scan_sast
from secura.dependencies import scan_dependency_files

def scan_directory(directory):
    all_findings = []

    allowed_extensions = {
        ".py",
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".java",
        ".cs",
        ".php",
        ".go",
        ".rb",
        ".cpp",
        ".c",
        ".h",
        ".json",
        ".yaml",
        ".yml",
        ".xml",
        ".env",
        ".ini",
        ".config",
        ".properties",
        ".toml",
    }

    for path in Path(directory).rglob("*"):

        if not path.is_file():
            continue

        if any(
            part in {".git", ".venv", "__pycache__" , "tests"}
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


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."

    print("=" * 50)
    print("           SECURA SECURITY SCAN")
    print("=" * 50)

    findings = scan_directory(directory)

    dependency_findings = scan_dependency_files(directory)
    findings.extend(dependency_findings)

    policy = load_policy()
    result = evaluate_policy(findings, policy)

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