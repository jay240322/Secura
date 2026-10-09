import json
import sys

def main():
    with open("secura-report.json", encoding="utf-8") as file:
        report = json.load(file)

    findings = report.get("findings", [])

    for finding in findings:
        severity = finding.get("severity","UNKNOWN")
        finding_type = finding.get("type","Security Finding")
        file_path = finding.get("file","")
        line = finding.get("line", 1)
        message = f"{severity}: {finding_type}"

        print(
            f"::error file={file_path}, line={line}::{message}"
        )

    if report.get("passed", False):
        print("Secura Security Gate: PASSED")

    else:
        print("Secura Security Gate: FAILED")

if __name__ == "__main__":
    main()
