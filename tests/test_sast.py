
from pathlib import Path

from secura.sast import scan_file


def scan_code(tmp_path, code):
    """Write sample code to a temporary file and scan it."""
    file_path = tmp_path / "sample.py"
    file_path.write_text(code, encoding="utf-8")
    return scan_file(file_path)


def test_sast_scanner():
    findings = scan_file("tests/fixtures/vulnerable.py")

    assert len(findings) == 4

    types = {finding["type"] for finding in findings}

    assert "SQL Injection" in types
    assert "Command Injection" in types
    assert "SSL Verification Disabled" in types
    assert "Weak MD5 Hashing" in types


def test_detects_command_injection(tmp_path):
    findings = scan_code(
        tmp_path,
        "import os\nos.system(user_input)\n",
    )

    assert any(f["type"] == "Command Injection" for f in findings)


def test_detects_disabled_ssl_verification(tmp_path):
    findings = scan_code(
        tmp_path,
        "requests.get(url, verify=False)\n",
    )

    assert any(
        f["type"] == "SSL Verification Disabled"
        for f in findings
    )


def test_detects_weak_md5_hashing(tmp_path):
    findings = scan_code(
        tmp_path,
        "hashlib.md5(data)\n",
    )

    assert any(f["type"] == "Weak MD5 Hashing" for f in findings)


def test_detects_sql_injection(tmp_path):
    findings = scan_code(
        tmp_path,
        'query = "SELECT * FROM users WHERE id = " + user_id\n',
    )

    assert any(f["type"] == "SQL Injection" for f in findings)


def test_safe_code_has_no_findings(tmp_path):
    findings = scan_code(
        tmp_path,
        "def add(a, b):\n    return a + b\n",
    )

    assert findings == []


def test_finding_contains_line_number(tmp_path):
    findings = scan_code(
        tmp_path,
        "# Safe comment\nos.system(user_input)\n",
    )

    command_findings = [
        f for f in findings if f["type"] == "Command Injection"
    ]

    assert len(command_findings) == 1
    assert command_findings[0]["line"] == 2