import json
import os
import urllib.error
import urllib.request

API_VERSION = "2022-11-28"
MAX_ANNOTATIONS = 50


def annotation_level(severity):
    severity = severity.upper()

    if severity in {"CRITICAL", "HIGH"}:
        return "failure"
    if severity == "MEDIUM":
        return "warning"
    return "notice"


def main():
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    event_path = os.environ.get("GITHUB_EVENT_PATH")

    if not token or not repository or not event_path:
        raise RuntimeError(
            "GITHUB_TOKEN, GITHUB_REPOSITORY, and "
            "GITHUB_EVENT_PATH must be set by GitHub Actions."
        )

    with open("secura-report.json", encoding="utf-8") as file:
        report = json.load(file)

    with open(event_path, encoding="utf-8") as file:
        event = json.load(file)

    pull_request = event.get("pull_request")
    if not pull_request:
        raise RuntimeError("This annotation publisher requires a pull_request event.")

    head_sha = pull_request["head"]["sha"]
    findings = report.get("findings", [])

    annotations = []

    for finding in findings:
        file_path = str(finding.get("file", "")).replace("\\", "/")
        line = finding.get("line", 1)

        if not file_path or not isinstance(line, int) or line < 1:
            continue

        annotations.append({
            "path": file_path,
            "start_line": line,
            "end_line": line,
            "annotation_level": annotation_level(
                finding.get("severity", "UNKNOWN")
            ),
            "title": finding.get("type", "Security Finding"),
            "message": (
                f"{finding.get('severity', 'UNKNOWN')}: "
                f"{finding.get('type', 'Security Finding')}"
            ),
        })

    api_url = f"https://api.github.com/repos/{repository}/check-runs"

    batches = [
        annotations[i:i + MAX_ANNOTATIONS]
        for i in range(0, len(annotations), MAX_ANNOTATIONS)
    ]

    if not batches:
        batches = [[]]

    for index, batch in enumerate(batches, start=1):
        name = "Secura Code Annotations"
        if len(batches) > 1:
            name += f" ({index}/{len(batches)})"

        summary = (
            f"Secura found {len(findings)} security finding(s). "
            f"Security gate: {'PASSED' if report.get('passed') else 'FAILED'}."
        )

        if not annotations:
            summary = "Secura found no valid findings to annotate."

        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": "success",
            "output": {
                "title": "Secura security findings",
                "summary": summary,
                "annotations": batch,
            },
        }

        request = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": API_VERSION,
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                print(f"Created {name}: HTTP {response.status}")
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"GitHub Checks API failed: HTTP {error.code}: {details}"
            ) from error

    print(f"Published {len(annotations)} annotation(s).")


if __name__ == "__main__":
    main()
