import re
from pathlib import Path

SAST_RULES = [
    {
        "type": "SQL Injection",
        "severity": "HIGH",
        "pattern": re.compile(
            r"""(?i)(SELECT|INSERT|UPDATE|DELETE).*(\+|\%|\bformat\s*\()"""
        ),
    },
    {
        "type":"Command Injection",
        "severity": "HIGH",
        "pattern": re.compile(
            r"""(?i)\bverify\s*=\s*False\b"""
        ),
    },
    {
        "type": "SSL Verification Disabled",
        "severity": "HIGH",
        "pattern": re.compile(
            r"""(?i)\bverify\s*=\s*False\b"""
        ),
    },
    {
        "type": "Weak MD5 Hashing",
        "severity": "MEDIUM",
        "pattern": re.compile(
            r"""(?i)\bhashlib\.md5\s*\("""
        ),
    },
]

def scan_file(file_path):
    findings = []

    try:
        content = Path(file_path).read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return findings

    for line_number, line in enumerate(content.splitlines(), start=1):

        for rule in SAST_RULES:

            if rule["pattern"].search(line):
                findings.append(
                    {
                        "type": rule["type"],
                        "severity": rule["severity"],
                        "file": str(file_path),
                        "line": line_number,
                    }
                )

    return findings 