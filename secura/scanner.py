import sys
from pathlib import Path

from secura.secrets import scan_file


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

        # Skip files and directories that should not be scanned
        if any(
            part in {".git", ".venv", "__pycache__"}
            for part in path.parts
        ):
            continue

        # Scan only supported source/configuration files
        if path.suffix.lower() not in allowed_extensions:
            continue

        findings = scan_file(path)
        all_findings.extend(findings)

    return all_findings


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."

    print("=" * 50)
    print("           SECURA SECURITY SCAN")
    print("=" * 50)

    findings = scan_directory(directory)

    if not findings:
        print("\n✓ No secrets detected.")
        print("✓ SECURITY GATE: PASSED")
        return 0

    print(f"\n⚠ {len(findings)} potential secret(s) detected:\n")

    for finding in findings:
        print(
            f"[HIGH] {finding['type']} "
            f"-> {finding['file']}:{finding['line']}"
        )

    print("\n✗ SECURITY GATE: FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
