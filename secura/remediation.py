
REMEDIATION_GUIDANCE = {
    "SQL Injection": {
        "risk": (
            "Unsafe SQL query construction may allow an attacker "
            "to alter a database query."
        ),
        "recommendation": (
            "Use parameterized queries or prepared statements. "
            "Avoid building SQL queries by concatenating untrusted input."
        ),
    },
    "Command Injection": {
        "risk": (
            "Operating-system commands may be manipulated if "
            "untrusted input reaches command execution."
        ),
        "recommendation": (
            "Avoid os.system() with untrusted input. Prefer "
            "subprocess.run() with an argument list and shell=False. "
            "Validate input against an allowlist where appropriate."
        ),
    },
    "SSL Verification Disabled": {
        "risk": (
            "Disabling certificate verification can expose "
            "connections to man-in-the-middle attacks."
        ),
        "recommendation": (
            "Enable TLS certificate verification. Remove verify=False "
            "and configure a trusted certificate authority when needed."
        ),
    },
    "Weak MD5 Hashing": {
        "risk": (
            "MD5 is unsuitable for security-sensitive hashing "
            "because it is vulnerable to collision attacks."
        ),
        "recommendation": (
            "For password storage, use a password-hashing algorithm "
            "such as Argon2id, bcrypt, or scrypt. For general-purpose "
            "integrity hashing, consider SHA-256 when appropriate."
        ),
    },
}


def enrich_findings(findings):
    """Add remediation guidance to recognized findings."""
    enriched = []

    for finding in findings:
        item = finding.copy()
        guidance = REMEDIATION_GUIDANCE.get(item.get("type"))

        if guidance:
            item["risk"] = guidance["risk"]
            item["recommendation"] = guidance["recommendation"]

        enriched.append(item)

    return enriched
