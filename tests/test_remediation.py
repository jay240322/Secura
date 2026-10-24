
from secura.remediation import enrich_findings


def test_command_injection_has_remediation():
    findings = [
        {
            "type": "Command Injection",
            "severity": "HIGH",
            "file": "app.py",
            "line": 10,
        }
    ]

    result = enrich_findings(findings)

    assert len(result) == 1
    assert result[0]["risk"]
    assert result[0]["recommendation"]
    assert "subprocess.run()" in result[0]["recommendation"]


def test_all_supported_findings_have_guidance():
    finding_types = [
        "SQL Injection",
        "Command Injection",
        "SSL Verification Disabled",
        "Weak MD5 Hashing",
    ]

    findings = [
        {"type": finding_type, "severity": "HIGH"}
        for finding_type in finding_types
    ]

    result = enrich_findings(findings)

    assert len(result) == len(finding_types)

    for finding in result:
        assert finding["risk"]
        assert finding["recommendation"]


def test_unknown_finding_is_preserved():
    finding = {
        "type": "Unknown Finding",
        "severity": "LOW",
        "file": "example.py",
        "line": 5,
    }

    result = enrich_findings([finding])

    assert result[0]["type"] == "Unknown Finding"
    assert "risk" not in result[0]
    assert "recommendation" not in result[0]


def test_original_findings_are_not_modified():
    finding = {
        "type": "SQL Injection",
        "severity": "HIGH",
        "file": "app.py",
        "line": 4,
    }

    original = finding.copy()
    enrich_findings([finding])

    assert finding == original
