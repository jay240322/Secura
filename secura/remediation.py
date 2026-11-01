REMEDIATION_GUIDANCE = {
    # SAST Vulnerabilities
    "SQL Injection": {
        "risk": (
            "Unsafe SQL query construction may allow an attacker "
            "to alter a database query, potentially leaking, modifying, "
            "or destroying data."
        ),
        "recommendation": (
            "Use parameterized queries or prepared statements. "
            "Avoid building SQL queries by concatenating untrusted input."
        ),
    },
    "Command Injection": {
        "risk": (
            "Operating-system commands may be manipulated if "
            "untrusted input reaches command execution, allowing arbitrary "
            "code execution."
        ),
        "recommendation": (
            "Avoid os.system() with untrusted input. Prefer "
            "subprocess.run() with an argument list and shell=False. "
            "Validate input against a strict allowlist where appropriate."
        ),
    },
    "SSL Verification Disabled": {
        "risk": (
            "Disabling certificate verification exposes network "
            "connections to man-in-the-middle (MITM) attacks and credential theft."
        ),
        "recommendation": (
            "Enable TLS certificate verification. Remove verify=False "
            "and configure a trusted certificate authority when needed."
        ),
    },
    "Weak MD5 Hashing": {
        "risk": (
            "MD5 is cryptographically broken and unsuitable for security-sensitive "
            "hashing because it is vulnerable to collision and preimage attacks."
        ),
        "recommendation": (
            "For password storage, use a salted, slow key derivation function "
            "such as Argon2id, bcrypt, or scrypt. For general-purpose integrity hashing, "
            "use SHA-256 or SHA-512."
        ),
    },

    # Secret / Credential Findings
    "Hardcoded Credential": {
        "risk": (
            "Hardcoded passwords, tokens, or credentials in source code can be extracted "
            "by attackers, leading to unauthorized account or infrastructure compromise."
        ),
        "recommendation": (
            "Remove credentials from source code immediately. Use environment variables "
            "or a dedicated secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager, "
            "GitHub Secrets). Revoke and rotate any credentials that have been committed."
        ),
    },
    "Possible Secret": {
        "risk": (
            "High-entropy strings matching credential signatures may expose sensitive keys, "
            "API secrets, or authentication tokens."
        ),
        "recommendation": (
            "Verify whether this value contains an active secret. If so, move it to "
            "secure configuration or environment variables, and rotate the secret."
        ),
    },
    "AWS Access Key": {
        "risk": (
            "Exposed AWS Access Key IDs can allow attackers to authenticate to AWS "
            "services and discover identity permissions."
        ),
        "recommendation": (
            "Immediately deactivate and rotate the key in the AWS IAM Console. "
            "Use IAM Roles, AWS Secrets Manager, or environment variables."
        ),
    },
    "AWS Secret Access Key": {
        "risk": (
            "Exposed AWS Secret Access Keys grant direct programmatic access to AWS "
            "resources according to the associated IAM policy."
        ),
        "recommendation": (
            "Immediately rotate the AWS access key pair in the IAM Console. Check CloudTrail "
            "logs for unauthorized API activity."
        ),
    },
    "GitHub Personal Access Token": {
        "risk": (
            "GitHub tokens allow attackers to read private repositories, modify code, "
            "and execute workflows under your identity."
        ),
        "recommendation": (
            "Revoke the token immediately in GitHub Settings > Developer settings. "
            "Audit recent commits and repository permissions."
        ),
    },
    "GitHub Fine-Grained Token": {
        "risk": (
            "Exposed GitHub Fine-Grained tokens grant scoped permissions to repositories, "
            "potentially allowing unauthorized code modification or data exfiltration."
        ),
        "recommendation": (
            "Revoke the token immediately from your GitHub account's Personal Access Tokens settings."
        ),
    },
    "GitHub OAuth Token": {
        "risk": (
            "Exposed GitHub OAuth tokens allow unauthorized access to GitHub accounts and repositories."
        ),
        "recommendation": (
            "Revoke the token in GitHub Settings and regenerate application credentials."
        ),
    },
    "GitHub Token": {
        "risk": (
            "Exposed GitHub tokens allow attackers to access GitHub resources and repositories."
        ),
        "recommendation": (
            "Revoke and regenerate the token immediately via GitHub Settings."
        ),
    },
    "Private Key": {
        "risk": (
            "Exposed private keys allow attackers to decrypt confidential traffic, "
            "forge signatures, or gain SSH/TLS access to production servers."
        ),
        "recommendation": (
            "Revoke the compromised key immediately. Generate a new key pair and replace "
            "all public keys on servers and service providers."
        ),
    },
    "PGP Private Key": {
        "risk": (
            "Exposed PGP private keys allow unauthorized decryption of sensitive communications "
            "and forgery of digital signatures."
        ),
        "recommendation": (
            "Revoke the PGP key with a revocation certificate and publish the revocation to keyservers."
        ),
    },
    "Google API Key": {
        "risk": (
            "Exposed Google Cloud API keys can be used by third parties to consume quota "
            "or access enabled Google APIs at your expense."
        ),
        "recommendation": (
            "Restrict or rotate the API key in the Google Cloud Console. Set application "
            "and API restrictions on the key."
        ),
    },
    "Google OAuth Client Secret": {
        "risk": (
            "Exposed OAuth client secrets can allow attackers to impersonate your application "
            "in OAuth authorization flows."
        ),
        "recommendation": (
            "Reset the client secret in the Google Cloud Console > Credentials."
        ),
    },
    "Slack Token": {
        "risk": (
            "Slack tokens can allow attackers to read channel history, post messages, "
            "or access private workspace files."
        ),
        "recommendation": (
            "Revoke the token in the Slack API app dashboard and rotate application credentials."
        ),
    },
    "Slack Webhook URL": {
        "risk": (
            "Exposed Slack webhook URLs allow unauthorized parties to send arbitrary messages "
            "into your Slack workspace channels."
        ),
        "recommendation": (
            "Delete the incoming webhook in your Slack App integration settings and generate a new one."
        ),
    },
    "Stripe Secret Key": {
        "risk": (
            "Exposed Stripe Secret Keys grant full access to your Stripe account, allowing "
            "attackers to initiate charges, refunds, or exfiltrate customer data."
        ),
        "recommendation": (
            "Roll the key immediately in the Stripe Dashboard > Developers > API keys. "
            "Review transaction logs for unauthorized charges."
        ),
    },
    "OpenAI API Key": {
        "risk": (
            "Exposed OpenAI API keys allow unauthorized API usage, racking up significant costs "
            "and accessing fine-tuned models or data."
        ),
        "recommendation": (
            "Revoke the key immediately in the OpenAI API settings and generate a new key."
        ),
    },
    "Anthropic API Key": {
        "risk": (
            "Exposed Anthropic API keys allow unauthorized usage of Claude models on your billing account."
        ),
        "recommendation": (
            "Revoke the key in the Anthropic Console under API Keys and generate a replacement."
        ),
    },
    "Hugging Face Token": {
        "risk": (
            "Exposed Hugging Face tokens allow access to private models, datasets, and inference endpoints."
        ),
        "recommendation": (
            "Revoke the token in Hugging Face Account Settings > Access Tokens."
        ),
    },
    "Discord Bot Token": {
        "risk": (
            "Exposed Discord Bot tokens grant full control over the bot across all Discord guilds it belongs to."
        ),
        "recommendation": (
            "Reset the bot token in the Discord Developer Portal immediately."
        ),
    },
    "Discord Webhook URL": {
        "risk": (
            "Exposed Discord webhook URLs allow anyone to send messages to the configured Discord channel."
        ),
        "recommendation": (
            "Delete and regenerate the webhook URL in Discord Channel Settings > Integrations."
        ),
    },
    "Telegram Bot Token": {
        "risk": (
            "Exposed Telegram Bot tokens allow attackers to hijack the bot, read messages, and execute commands."
        ),
        "recommendation": (
            "Revoke and regenerate the token via @BotFather on Telegram."
        ),
    },
    "SendGrid API Key": {
        "risk": (
            "Exposed SendGrid keys allow attackers to send phishing emails through your verified domain."
        ),
        "recommendation": (
            "Delete the API key in the SendGrid dashboard and create a new key with minimum required scopes."
        ),
    },
    "Mailgun API Key": {
        "risk": (
            "Exposed Mailgun keys allow unauthorized sending of emails from your configured sending domains."
        ),
        "recommendation": (
            "Rotate the API key in the Mailgun Control Panel under API Security."
        ),
    },
    "NPM Access Token": {
        "risk": (
            "Exposed NPM tokens enable attackers to publish malicious package versions (supply chain attack)."
        ),
        "recommendation": (
            "Revoke the token immediately via `npm token revoke` or the npmjs.com dashboard."
        ),
    },
    "PyPI API Token": {
        "risk": (
            "Exposed PyPI tokens allow attackers to upload malicious package releases to PyPI."
        ),
        "recommendation": (
            "Revoke the token in PyPI Account Settings and audit package release history."
        ),
    },
    "Twilio API Key": {
        "risk": (
            "Exposed Twilio credentials allow unauthorized SMS, voice calls, and account resource access."
        ),
        "recommendation": (
            "Delete and replace the API Key in the Twilio Console."
        ),
    },
    "Database Connection String": {
        "risk": (
            "Database connection strings with embedded passwords allow attackers direct access "
            "to production or staging databases."
        ),
        "recommendation": (
            "Change the database user's password immediately. Store connection strings in "
            "environment variables and avoid committing credentials to version control."
        ),
    },
    "JSON Web Token": {
        "risk": (
            "Hardcoded JWTs may grant unauthorized access to APIs and services if still valid."
        ),
        "recommendation": (
            "Do not commit static JWTs. Use short-lived tokens generated dynamically at runtime."
        ),
    },
    "Dependency Vulnerability": {
        "risk": (
            "Using libraries with known security vulnerabilities can expose applications "
            "to remote code execution, denial of service, or authentication bypass."
        ),
        "recommendation": (
            "Upgrade the vulnerable package to a fixed version in your dependency manifest."
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
