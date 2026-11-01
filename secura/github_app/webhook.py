
import logging

import requests

from secura.github_app.auth import GITHUB_API_URL


logger = logging.getLogger("secura.github_app.checks")


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    conclusion: str,
    title: str,
    summary: str,
    name: str = "Secura Security Gate",
):
    """Create a GitHub Check Run for a Secura scan."""

    # Only allow valid completed Check Run conclusions.
    allowed_conclusions = {
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "skipped",
    }

    if conclusion not in allowed_conclusions:
        raise ValueError(
            f"Invalid Check Run conclusion: {conclusion}"
        )

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