import json
import os
import urllib.error
import urllib.request

API_VERSION = "2022-11-28"
MAX_ANNOTATIONS = 50


def annotation_level(severity: str) -> str:
    """Map Secura severity to GitHub Check Run annotation level."""
    severity = str(severity).upper()

    if severity in {"CRITICAL", "HIGH"}:
        return "failure"
    if severity == "MEDIUM":
        return "warning"
    return "notice"


def main():
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    event_path = os.environ.get("GITHUB_EVENT_PATH")

    if not token or not repository:
        raise RuntimeError(
            "GITHUB_TOKEN and GITHUB_REPOSITORY must be set by GitHub Actions."
        )

    if not os.path.exists("secura-report.json"):
        print("secura-report.json not found; skipping annotations.")
        return

    with open("secura-report.json", encoding="utf-8") as file:
        report = json.load(file)

    head_sha = None
    event = {}
    if event_path and os.path.exists(event_path):
        with open(event_path, encoding="utf-8") as file:
            event = json.load(file)

        pull_request = event.get("pull_request")
        if pull_request:
            head_sha = pull_request.get("head", {}).get("sha")
        elif event.get("after") and event["after"] != "0000000000000000000000000000000000000000":
            head_sha = event.get("after")

    if not head_sha:
        head_sha = os.environ.get("GITHUB_SHA")

    if not head_sha:
        print("Could not determine head_sha; skipping GitHub Annotations check run.")
        return

    findings = report.get("findings", [])
    passed = report.get("passed", False)
    counts = report.get("counts", {})

    has_violations = (
        not passed
        or counts.get("CRITICAL", 0) > 0
        or counts.get("HIGH", 0) > 0
    )

    conclusion = "failure" if (has_violations or findings) else "success"

    annotations = []
    for finding in findings:
        file_path = str(finding.get("file", "")).replace("\\", "/")
        line = finding.get("line", 1)

        if not file_path or not isinstance(line, int) or line < 1:
            continue

        f_type = finding.get("type", "Security Finding")
        f_sev = finding.get("severity", "HIGH")
        msg = f"{f_sev}: {f_type}"
        if finding.get("recommendation"):
            msg += f"\nRemediation: {finding['recommendation']}"

        annotations.append({
            "path": file_path,
            "start_line": line,
            "end_line": line,
            "annotation_level": annotation_level(f_sev),
            "title": f_type,
            "message": msg,
        })

    api_url = f"https://api.github.com/repos/{repository}/check-runs"

    batches = [
        annotations[i:i + MAX_ANNOTATIONS]
        for i in range(0, len(annotations), MAX_ANNOTATIONS)
    ]

    if not batches:
        batches = [[]]

    score = report.get("score", 100 if conclusion == "success" else 0)

    for index, batch in enumerate(batches, start=1):
        name = "Secura Security Scanner"
        if len(batches) > 1:
            name += f" ({index}/{len(batches)})"

        if conclusion == "failure":
            title = f"Failed - {len(findings)} finding(s) detected (Score: {score}/100)"
            summary = (
                f"❌ **MERGE BLOCKED: Unsafe to merge into main.**\n\n"
                f"Secura detected **{len(findings)} security finding(s)**. "
                f"Security score: `{score}/100`.\n\n"
                "Review the findings and annotations below. Remove all hardcoded "
                "secrets and policy violations before merging this branch into main."
            )
        else:
            title = f"Passed - 0 secrets detected (Score: 100/100)"
            summary = (
                "✅ **Secura Security Gate: PASSED**\n\n"
                "Secura detected no secrets or policy violations. "
                "This commit is clean and safe to merge into main."
            )

        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": conclusion,
            "details_url": f"https://secura.app/findings?repo={repository}&sha={head_sha}",
            "output": {
                "title": title,
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
                print(f"Created {name}: HTTP {response.status} (Conclusion: {conclusion})")
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"GitHub Checks API failed: HTTP {error.code}: {details}"
            ) from error

    print(f"Published {len(annotations)} annotation(s) with conclusion '{conclusion}'.")


if __name__ == "__main__":
    main()
