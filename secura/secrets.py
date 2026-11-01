
import re
from pathlib import Path


# Known secret formats
SECRET_PATTERNS = {
    "AWS Access Key": re.compile(
        r"\bAKIA[0-9A-Z]{16}\b"
    ),

    "GitHub Token": re.compile(
        r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"
    ),

    "GitHub Fine-Grained Token": re.compile(
        r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"
    ),

    "Private Key": re.compile(
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ),

    "Google API Key": re.compile(
        r"\bAIza[0-9A-Za-z_-]{35}\b"
    ),

    "Slack Token": re.compile(
        r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"
    ),

    "Stripe Secret Key": re.compile(
        r"\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b"
    ),
}


# Detect credential-like variable names, including camelCase and
# names such as DatabasePassword, DB_PASSWORD, and API_KEY.
CREDENTIAL_ASSIGNMENT = re.compile(
    r"""
    (?ix)
    \b
    (?:
        [a-z0-9]*(?:password|passwd|pwd)[a-z0-9]*
        |
        [a-z0-9]*(?:secret|token)[a-z0-9]*
        |
        [a-z0-9]*(?:api[_-]?key)[a-z0-9]*
        |
        [a-z0-9]*(?:access[_-]?key)[a-z0-9]*
        |
        [a-z0-9]*(?:client[_-]?secret)[a-z0-9]*
        |
        [a-z0-9]*(?:private[_-]?key)[a-z0-9]*
    )
    \s*
    (?::|=)
    \s*
    (?:
        ["']
        (?P<quoted>[^"']{4,})
        ["']
        |
        (?P<unquoted>[^\s,;#]{6,})
    )
    """
)


# Generic assignment detection for values that look like long,
# high-entropy credentials. This is heuristic and may produce
# false positives.
GENERIC_SECRET_ASSIGNMENT = re.compile(
    r"""
    (?ix)
    \b
    (?:key|credential|auth|bearer)
    \b
    \s*
    (?::|=)
    \s*
    ["']
    (?P<value>[A-Za-z0-9_./+=-]{20,})
    ["']
    """
)


def scan_file(file_path):
    findings = []

    try:
        content = Path(file_path).read_text(
            encoding="utf-8",
            errors="ignore",
        )
    except (OSError, ValueError):
        return findings

    for line_number, line in enumerate(content.splitlines(), start=1):

        # Check known secret formats.
        for secret_type, pattern in SECRET_PATTERNS.items():
            if pattern.search(line):
                findings.append({
                    "type": secret_type,
                    "severity": "HIGH",
                    "file": str(file_path),
                    "line": line_number,
                })

        # Check credential-like variable assignments.
        assignment_match = CREDENTIAL_ASSIGNMENT.search(line)

        if assignment_match:
            value = (
                assignment_match.group("quoted")
                or assignment_match.group("unquoted")
                or ""
            ).strip()

            # Ignore common placeholders and empty values.
            placeholders = {
                "your_password",
                "your_secret",
                "your_api_key",
                "changeme",
                "change_me",
                "example",
                "placeholder",
                "none",
                "null",
                "undefined",
            }

            if (
                len(value) >= 6
                and value.lower() not in placeholders
                and not value.startswith("${")
            ):
                findings.append({
                    "type": "Hardcoded Credential",
                    "severity": "HIGH",
                    "file": str(file_path),
                    "line": line_number,
                })

        # Check generic credential-looking assignments.
        generic_match = GENERIC_SECRET_ASSIGNMENT.search(line)

        if generic_match:
            value = generic_match.group("value")

            if len(value) >= 20:
                findings.append({
                    "type": "Possible Secret",
                    "severity": "HIGH",
                    "file": str(file_path),
                    "line": line_number,
                })

    # Avoid duplicate findings for the same type, file, and line.
    unique_findings = []
    seen = set()

    for finding in findings:
        key = (
            finding["type"],
            finding["file"],
            finding["line"],
        )

        if key not in seen:
            seen.add(key)
            unique_findings.append(finding)

    return unique_findings
