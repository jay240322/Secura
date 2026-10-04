from secura.vulnerabilities import scan_dependency


def test_scan_dependency(monkeypatch):

    def fake_query_osv(package_name, version, ecosystem):
        return {
            "vulns": [
                {
                    "id": "GHSA-TEST-1234",
                    "summary": "Test vulnerability",
                    "severity": [
                        {
                            "type": "CVSS_V3",
                            "score": 9.8,
                        }
                    ],
                }
            ]
        }

    monkeypatch.setattr(
        "secura.vulnerabilities.query_osv",
        fake_query_osv,
    )

    findings = scan_dependency(
        "requests",
        "2.19.0",
        "PyPI",
        "requirements.txt",
    )

    assert len(findings) == 1
    assert findings[0]["type"] == "Dependency Vulnerability"
    assert findings[0]["severity"] == "CRITICAL"
    assert findings[0]["package"] == "requests"
    assert findings[0]["vulnerability_id"] == "GHSA-TEST-1234"