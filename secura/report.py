
import json
from pathlib import Path

from secura.remediation import enrich_findings


def generate_report(result, findings, output_path="secura-report.json"):
    report = {
        "passed": result["passed"],
        "score": result["score"],
        "counts": result["counts"],
        "failures": result["failures"],
        "findings": enrich_findings(findings),
    }

    Path(output_path).write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    return output_path