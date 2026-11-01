
import logging

import requests

from secura.github_app.auth import GITHUB_API_URL


logger = logging.getLogger("secura.github_app.checks")


ALLOWED_CONCLUSIONS = {
    "success",
    "failure",
    "neutral",
    "cancelled",
    "timed_out",
    "action_required",
    "skipped",
}


def build_check_output(
    findings: list[dict] | None = None,
) -> tuple[str, str, str]:
    """
    Build the Check Run conclusion, title, and summary
    from scanner findings.
    """

    findings = findings or []

    if findings:
        conclusion = "failure"
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
        conclusion = "success"
        title = "Secura security scan passed"
        summary = "Secura did not find policy violations."

    return conclusion, title, summary


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    findings: list[dict] | None = None,
    name: str = "Secura Security Gate",
):
    """
    Create a completed GitHub Check Run based on scanner findings.
    """

    conclusion, title, summary = build_check_output(findings)

    if conclusion not in ALLOWED_CONCLUSIONS:
        raise ValueError(
            f"Invalid Check Run conclusion: {conclusion}"
        )

    url = (
        f"{GITHUB_API_URL}/repos/"
        f"{owner}/{repo}/check-runs"
    )

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
            "GitHub Check Run API error. "
            "Status: %s, Response: %s",
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
