
import logging

import requests

from secura.github_app.auth import GITHUB_API_URL


logger = logging.getLogger("secura.github_app.checks")


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    findings: list[dict] | None = None,
    name: str = "Secura Security Gate",
):
    """Create a GitHub Check Run based on scanner findings."""

    findings = findings or []

    has_findings = len(findings) > 0

    conclusion = "failure" if has_findings else "success"

    if has_findings:
        title = "Secura detected potential secrets"
        summary = (
            f"Secura detected {len(findings)} potential secret(s).\n\n"
            "Review the findings below and remove any exposed credentials."
        )

        for finding in findings:
            summary += (
                f"\n- **{finding.get('type', 'Secret')}**"
                f" — `{finding.get('file', 'unknown')}`"
                f" — line {finding.get('line', 'unknown')}"
                f" — Severity: {finding.get('severity', 'HIGH')}"
            )

    else:
        title = "Secura security scan passed"
        summary = "Secura did not find policy violations."

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/check-runs"

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {installation_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={
            "name": name,
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": conclusion,
            "output": {
                "title": title,
                "summary": summary,
            },
        },
        timeout=15,
    )

    if not response.ok:
        logger.error(
            "GitHub Check Run API error. Status: %s, Response: %s",
            response.status_code,
            response.text,
        )

    response.raise_for_status()

    check_run = response.json()

    logger.info(
        "Created Check Run: %s (ID: %s, Conclusion: %s)",
        check_run.get("name"),
        check_run.get("id"),
        check_run.get("conclusion"),
    )

    return check_run
