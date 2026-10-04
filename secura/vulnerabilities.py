import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OSV_API_URL = "https://api.osv.dev/v1/query"


def get_severity(vulnerability):
    severity_data = vulnerability.get("severity", [])

    for severity in severity_data:
        score = severity.get("score")

        if not score:
            continue

        try:
            score = float(score)
        except (TypeError, ValueError):
            continue

        if score >= 9.0:
            return "CRITICAL"

        if score >= 7.0:
            return "HIGH"

        if score >= 4.0:
            return "MEDIUM"

        return "LOW"

    return "MEDIUM"


def query_osv(package_name, version, ecosystem):
    payload = {
        "package": {
            "name": package_name,
            "ecosystem": ecosystem,
        },
        "version": version,
    }

    request = Request(
        OSV_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Secura-Security-Scanner",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(
                response.read().decode("utf-8")
            )

    except (HTTPError, URLError, TimeoutError):
        return None


def scan_dependency(
    package_name,
    version,
    ecosystem,
    file_path,
):
    response = query_osv(
        package_name,
        version,
        ecosystem,
    )

    if not response:
        return []

    vulnerabilities = response.get("vulns", [])
    findings = []

    for vulnerability in vulnerabilities:
        severity = get_severity(vulnerability)

        findings.append(
            {
                "type": "Dependency Vulnerability",
                "severity": severity,
                "package": package_name,
                "version": version,
                "ecosystem": ecosystem,
                "vulnerability_id": vulnerability.get(
                    "id",
                    "UNKNOWN",
                ),
                "summary": vulnerability.get(
                    "summary",
                    "Known vulnerability detected",
                ),
                "file": str(file_path),
            }
        )

    return findings