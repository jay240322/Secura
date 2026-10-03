import re
from pathlib import Path


SECRET_PATTERNS = {
    "AWS Access Key": r"\bAKIA[0-9A-Z]{16}\b",
    "GitHub Token": r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b",
    "API Key": r"(?i)\b(api[_-]?key)\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{16,}",
    "Password": r"(?i)\b(password|passwd|pwd)\s*[:=]\s*[\"']?[^\"'\s]{6,}",
    "Private Key": r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "Secret Token": r"(?i)\b(secret|token)\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{16,}",
}


def scan_file(file_path):
    findings = []

    try:
        content = Path(file_path).read_text(
            encoding="utf-8",
            errors="ignore"
        )
    except Exception:
        return findings

    for line_number, line in enumerate(content.splitlines(), start=1):
        for secret_type, pattern in SECRET_PATTERNS.items():
            if re.search(pattern, line):
                findings.append({
                    "type": secret_type,
                    "severity": "HIGH",
                    "file": str(file_path),
                    "line": line_number,
                })

    return findings