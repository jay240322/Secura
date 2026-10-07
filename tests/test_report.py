import json
from secura.report import generate_report

def test_generate_report(tmp_path):

    result = {
        "passed": False,
        "score": 80,
        "counts": {
            "CRITICAL": 0,
            "HIGH": 1,
            "MEDIUM": 0,
            "LOW": 0,
        },
        "failures": [
            "High findings: 1 (maximum allowed: 0)"
        ],
    }

    findings = [
        {
            "type": "SQL Injection",
            "severity": "HIGH",
            "file": "app.py",
            "line": 10,
        }
    ]

    output_file = tmp_path / "secura-report.json"

    generate_report(
        result,
        findings,
        output_file,
    )

    assert output_file.exists()

    report = json.loads(
        output_file.read_text(encoding="utf-8")
    )

    assert report["passed"] is False
    assert report["score"] == 80
    assert report["counts"]["HIGH"] == 1
    assert len(report["findings"]) == 1