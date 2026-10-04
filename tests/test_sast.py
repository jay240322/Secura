from secura.sast import scan_file


def test_sast_scanner():

    findings = scan_file("tests/fixtures/vulnerable.py")

    assert len(findings) == 4

    types = {finding["type"] for finding in findings}

    assert "SQL Injection" in types
    assert "Command Injection" in types
    assert "SSL Verification Disabled" in types
    assert "Weak MD5 Hashing" in types