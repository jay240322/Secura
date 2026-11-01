from secura.secrets import scan_content
from secura.pr_changes import is_scannable_file
from secura.github_app.checks import build_check_output


def test_detect_aws_access_key():
    # Split token prefix to avoid triggering remote git push protection filters
    key = "AK" + "IA1234567890ABCDEF"
    content = f'AWS_KEY = "{key}"\n'
    findings = scan_content(content)
    types = {f["type"] for f in findings}
    assert "AWS Access Key" in types


def test_detect_aws_secret_key():
    secret = "wJalr" + "XUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    content = f'aws_secret_access_key = "{secret}"\n'
    findings = scan_content(content)
    types = {f["type"] for f in findings}
    assert "AWS Secret Access Key" in types or "Hardcoded Credential" in types


def test_detect_github_tokens():
    # Classic PAT
    token1 = "gh" + "p_abcdefghijklmnopqrstuvwxyz1234567890"
    findings1 = scan_content(f"token = '{token1}'\n")
    assert any("GitHub" in f["type"] for f in findings1)

    # Fine-grained PAT
    token2 = "github_" + "pat_11AAAAAAA0000000000000_123456789012345678901234567890"
    findings2 = scan_content(f"token = '{token2}'\n")
    assert any("Fine-Grained" in f["type"] for f in findings2)


def test_detect_private_key():
    header = "-----BEGIN " + "RSA PRIVATE KEY-----"
    footer = "-----END " + "RSA PRIVATE KEY-----"
    content = f"{header}\nMIIEowIBAAKCAQEA0...\n{footer}\n"
    findings = scan_content(content)
    assert any(f["type"] == "Private Key" for f in findings)
    assert any(f["severity"] == "CRITICAL" for f in findings)


def test_detect_google_api_key():
    key = "AI" + "zaSyD-1234567890abcdefghijklmnopqrst"
    content = f'GOOGLE_KEY = "{key}"\n'
    findings = scan_content(content)
    assert any(f["type"] == "Google API Key" for f in findings)


def test_detect_slack_token_and_webhook():
    token_prefix = "xox" + "b-"
    slack_token = f"{token_prefix}1234567890-123456789012-abcdefghijklmnopqrstuvwx"
    content = f'token = "{slack_token}"\n'
    findings = scan_content(content)
    assert any(f["type"] == "Slack Token" for f in findings)

    slack_host = "hooks." + "slack.com"
    webhook_content = f'url = "https://{slack_host}/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"\n'
    findings2 = scan_content(webhook_content)
    assert any(f["type"] == "Slack Webhook URL" for f in findings2)


def test_detect_stripe_key():
    stripe_prefix = "sk" + "_test_"
    content = f'STRIPE_SECRET = "{stripe_prefix}51Abcdefghijklmnopqrstuv"\n'
    findings = scan_content(content)
    assert any(f["type"] == "Stripe Secret Key" for f in findings)


def test_detect_openai_and_anthropic_keys():
    openai_prefix = "sk" + "-proj-"
    openai_key = f'openai_key = "{openai_prefix}abcdefghijklmnopqrstuvwxyz123456"\n'
    findings1 = scan_content(openai_key)
    assert any(f["type"] == "OpenAI API Key" for f in findings1)

    anthropic_prefix = "sk" + "-ant-"
    anthropic_key = f'anthropic_key = "{anthropic_prefix}api03-abcdefghijklmnopqrstuvwxyz123456"\n'
    findings2 = scan_content(anthropic_key)
    assert any(f["type"] == "Anthropic API Key" for f in findings2)


def test_detect_database_connection_string():
    content = 'DATABASE_URL = "postgres://admin:SuperSecretPass123@db.example.com:5432/mydb"\n'
    findings = scan_content(content)
    assert any(f["type"] == "Database Connection String" for f in findings)


def test_detect_hardcoded_credentials_in_dotenv_format():
    content = 'DB_PASSWORD=MySecretPassword123!\nAPI_KEY=abcdef1234567890\n'
    findings = scan_content(content)
    assert len(findings) >= 2
    assert all(f["type"] == "Hardcoded Credential" for f in findings)


def test_ignore_placeholders_and_env_references():
    safe_content = """
    password = "your_password"
    db_pass = "changeme"
    api_key = "${API_KEY}"
    secret = os.environ.get("MY_SECRET")
    token = process.env.TOKEN
    access_key = "example"
    pwd: str = ""
    """
    findings = scan_content(safe_content)
    assert len(findings) == 0


def test_is_scannable_file():
    assert is_scannable_file(".env") is True
    assert is_scannable_file(".env.local") is True
    assert is_scannable_file(".env.production") is True
    assert is_scannable_file("app.py") is True
    assert is_scannable_file("config.yaml") is True
    assert is_scannable_file("secrets.txt") is True
    assert is_scannable_file("server.key") is True
    assert is_scannable_file("image.png") is False
    assert is_scannable_file(".git/config") is False
    assert is_scannable_file(".venv/lib/python.py") is False


def test_build_check_output_with_findings():
    findings = [
        {
            "type": "Hardcoded Credential",
            "severity": "HIGH",
            "file": "app.py",
            "line": 15,
            "recommendation": "Use environment variables.",
        }
    ]
    conclusion, title, summary, annotations = build_check_output(findings=findings)

    assert conclusion == "failure"
    assert "FAILED" in title
    assert "MERGE BLOCKED" in summary
    assert len(annotations) == 1
    assert annotations[0]["annotation_level"] == "failure"
    assert annotations[0]["start_line"] == 15


def test_build_check_output_passed():
    conclusion, title, summary, annotations = build_check_output(findings=[])

    assert conclusion == "success"
    assert "PASSED" in title
    assert "safe to merge" in summary.lower()
    assert len(annotations) == 0
