import re
from pathlib import Path


# Known high-confidence secret formats
SECRET_PATTERNS = {
    "AWS Access Key": re.compile(
        r"\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b"
    ),
    "AWS Secret Access Key": re.compile(
        r"""(?i)\b(?:aws[_-]?(?:secret[_-]?access[_-]?key|secret[_-]?key|access[_-]?secret))\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?"""
    ),
    "GitHub Personal Access Token": re.compile(
        r"\bghp_[A-Za-z0-9]{36}\b"
    ),
    "GitHub Fine-Grained Token": re.compile(
        r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"
    ),
    "GitHub OAuth Token": re.compile(
        r"\bgh[osru]_[A-Za-z0-9]{36,}\b"
    ),
    "Private Key": re.compile(
        r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY(?: BLOCK)?-----"
    ),
    "PGP Private Key": re.compile(
        r"-----BEGIN PGP PRIVATE KEY BLOCK-----"
    ),
    "Google API Key": re.compile(
        r"\bAIza[0-9A-Za-z_-]{32,38}\b"
    ),
    "Google OAuth Client Secret": re.compile(
        r"""(?i)"client_secret"\s*:\s*"[A-Za-z0-9_-]{24,}"""
    ),
    "Slack Token": re.compile(
        r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b"
    ),
    "Slack Webhook URL": re.compile(
        r"https://hooks\.slack\.com/services/T[0-9A-Za-z_]+/B[0-9A-Za-z_]+/[0-9A-Za-z_]+"
    ),
    "Stripe Secret Key": re.compile(
        r"\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}\b"
    ),
    "OpenAI API Key": re.compile(
        r"\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b"
    ),
    "Anthropic API Key": re.compile(
        r"\bsk-ant-[a-zA-Z0-9_-]{20,}\b"
    ),
    "Hugging Face Token": re.compile(
        r"\bhf_[a-zA-Z0-9]{34,}\b"
    ),
    "Discord Bot Token": re.compile(
        r"\b[MN][A-Za-z0-9]{23,26}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}\b"
    ),
    "Discord Webhook URL": re.compile(
        r"https://discord(?:app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+"
    ),
    "Telegram Bot Token": re.compile(
        r"\b[0-9]{8,10}:[a-zA-Z0-9_-]{35}\b"
    ),
    "SendGrid API Key": re.compile(
        r"\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b"
    ),
    "Mailgun API Key": re.compile(
        r"\bkey-[0-9a-zA-Z]{32}\b"
    ),
    "NPM Access Token": re.compile(
        r"\bnpm_[A-Za-z0-9]{36}\b"
    ),
    "PyPI API Token": re.compile(
        r"\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}\b"
    ),
    "Twilio API Key": re.compile(
        r"\bSK[0-9a-fA-F]{32}\b"
    ),
    "Database Connection String": re.compile(
        r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql)://[^\s:@]+:[^\s:@]+@[^\s/]+"
    ),
    "JSON Web Token": re.compile(
        r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"
    ),
}

CRITICAL_SECRET_TYPES = {
    "Private Key",
    "PGP Private Key",
    "AWS Secret Access Key",
    "GitHub Personal Access Token",
    "GitHub Fine-Grained Token",
    "GitHub OAuth Token",
    "Stripe Secret Key",
    "Database Connection String",
}

# Variable name patterns for credential assignment
CREDENTIAL_ASSIGNMENT = re.compile(
    r"""
    \b
    (?P<var_name>
        [a-z0-9_]*(?:password|passwd|pwd)[a-z0-9_]*
        |
        [a-z0-9_]*(?:secret|token)[a-z0-9_]*
        |
        [a-z0-9_]*(?:api[_-]?key)[a-z0-9_]*
        |
        [a-z0-9_]*(?:access[_-]?key)[a-z0-9_]*
        |
        [a-z0-9_]*(?:client[_-]?secret)[a-z0-9_]*
        |
        [a-z0-9_]*(?:private[_-]?key)[a-z0-9_]*
        |
        [a-z0-9_]*(?:auth[_-]?token)[a-z0-9_]*
        |
        [a-z0-9_]*(?:encryption[_-]?key)[a-z0-9_]*
        |
        [a-z0-9_]*(?:db[_-]?pass)[a-z0-9_]*
    )
    \s*
    (?::|=|:=)
    \s*
    (?:
        ["'](?P<quoted>[^"']{4,})["']
        |
        (?P<unquoted>[^\s,;#]{6,})
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Generic assignment detection for values that look like long credentials
GENERIC_SECRET_ASSIGNMENT = re.compile(
    r"""
    \b
    (?:key|credential|auth|bearer)
    \b
    \s*
    (?::|=|:=)
    \s*
    ["']
    (?P<value>[A-Za-z0-9_./+=-]{20,})
    ["']
    """,
    re.IGNORECASE | re.VERBOSE,
)

PLACEHOLDERS = {
    "your_password",
    "your_secret",
    "your_api_key",
    "your_token",
    "changeme",
    "change_me",
    "example",
    "placeholder",
    "none",
    "null",
    "undefined",
    "true",
    "false",
    "dummy",
    "admin",
    "password",
    "secret",
    "test",
    "testing",
    "default",
    "sample",
    "fake",
    "todo",
    "fixme",
    "string",
    "number",
    "bearer",
    "basic",
    "jwt",
    "oauth",
    "session",
    "digest",
}

SAFE_PREFIXES = (
    "${",
    "{{",
    "process.env.",
    "os.environ",
    "os.getenv",
    "sys.env",
    "system.getenv",
    "env(",
    "config(",
    "get(",
    "get_env(",
    "dotenv",
    "settings.",
)

SAFE_UNQUOTED_VALUES = {
    "str",
    "int",
    "bool",
    "float",
    "none",
    "null",
    "undefined",
    "true",
    "false",
    "string",
    "number",
    "boolean",
    "any",
    "unknown",
    "never",
    "void",
    "optional[str]",
}


def is_placeholder_or_safe(value: str, var_name: str = "", is_quoted: bool = True) -> bool:
    """Check if value is a harmless placeholder, variable reference, or environment reference."""
    clean = value.strip().rstrip(",;:()[]{}>")
    lower = clean.lower()
    var_lower = var_name.strip().lower()

    if not clean or len(clean) < 4:
        return True

    # Ignore function/method signatures & handlers containing credential keywords
    if var_lower.startswith((
        "signin", "createuser", "handle", "get", "set", "verify", "hash", "validate", "on", "test"
    )):
        return True

    # Ignore OAuth/HTTP token type or scheme fields (e.g. token_type="bearer", auth_type="basic")
    if var_lower.endswith(("_type", "type")) or var_lower in ("token_type", "auth_type", "grant_type"):
        if lower in (
            "bearer", "basic", "jwt", "oauth", "session", "digest",
            "client_credentials", "authorization_code", "refresh_token", "password"
        ):
            return True

    if lower in PLACEHOLDERS:
        return True

    if any(prefix in lower for prefix in (
        "process.env", "os.environ", "os.getenv", "settings.", "config.", "${", "{{", "dotenv", "system.getenv", "sys.env"
    )):
        return True

    if not is_quoted:
        # Common type annotations in Python / TypeScript (e.g. Optional[str], Union[...], Record<...>)
        raw_clean = value.strip().rstrip(",;:")
        raw_lower = raw_clean.lower()
        if raw_lower in SAFE_UNQUOTED_VALUES or lower in SAFE_UNQUOTED_VALUES:
            return True

        if any(raw_lower.startswith(p) for p in ("optional[", "union[", "list[", "dict[", "set[", "record<", "literal[")):
            return True

        if "[" in raw_clean or "]" in raw_clean or "|" in raw_clean or "<" in raw_clean or ">" in raw_clean:
            return True

        # Function calls or invocations (e.g. create_access_token(...))
        if "(" in clean or ")" in clean:
            return True

        # Property access or method reference (e.g. authModule.signInWithEmailAndPassword, credential?.accessToken)
        if "." in clean or "?." in clean:
            return True

        # Variable passed to a parameter with the same name
        if lower == var_lower:
            return True

        # Common types in TypeScript / Python
        if lower in SAFE_UNQUOTED_VALUES:
            return True

        if clean.startswith(":") or clean.startswith("="):
            return True

        # Pure variable identifier passed as keyword argument
        if re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", clean) and not any(c.isdigit() for c in clean):
            return True

    return False


def scan_content(content: str, file_path: str = "<memory>") -> list[dict]:
    """Scan string content for secrets and credentials."""
    findings = []

    for line_number, line in enumerate(content.splitlines(), start=1):
        matched_specific = False

        # 1. Check known specific secret formats
        for secret_type, pattern in SECRET_PATTERNS.items():
            if pattern.search(line):
                severity = (
                    "CRITICAL"
                    if secret_type in CRITICAL_SECRET_TYPES
                    else "HIGH"
                )
                findings.append({
                    "type": secret_type,
                    "severity": severity,
                    "file": str(file_path),
                    "line": line_number,
                })
                matched_specific = True

        # 2. Check credential-like variable assignments only if no specific format already matched
        if not matched_specific:
            assignment_match = CREDENTIAL_ASSIGNMENT.search(line)
            if assignment_match:
                var_name = assignment_match.group("var_name") or ""
                quoted = assignment_match.group("quoted")
                unquoted = assignment_match.group("unquoted")
                value = (quoted or unquoted or "").strip()
                is_quoted = quoted is not None

                if not is_placeholder_or_safe(value, var_name=var_name, is_quoted=is_quoted):
                    findings.append({
                        "type": "Hardcoded Credential",
                        "severity": "HIGH",
                        "file": str(file_path),
                        "line": line_number,
                    })

        # 3. Check generic credential assignments only if no finding on this line yet
        if not matched_specific and not any(f["line"] == line_number for f in findings):
            generic_match = GENERIC_SECRET_ASSIGNMENT.search(line)
            if generic_match:
                value = generic_match.group("value")
                if not is_placeholder_or_safe(value, is_quoted=True):
                    findings.append({
                        "type": "Possible Secret",
                        "severity": "HIGH",
                        "file": str(file_path),
                        "line": line_number,
                    })

    # Deduplicate findings on (type, file, line)
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


def scan_file(file_path: str | Path) -> list[dict]:
    """Scan a file on disk for secrets."""
    try:
        content = Path(file_path).read_text(
            encoding="utf-8",
            errors="ignore",
        )
    except (OSError, ValueError):
        return []

    return scan_content(content, file_path=str(file_path))
