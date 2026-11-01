
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


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    conclusion: str,
    title: str,
    summary: str,
    name: str = "Secura Security Gate",
) -> dict:
    """
    Create a completed GitHub Check Run for a Secura security scan.

    Args:
        installation_token: GitHub App installation access token.
        owner: GitHub repository owner.
        repo: GitHub repository name.
        head_sha: Commit SHA associated with the scan.
        conclusion: Final result of the security scan.
        title: Check Run output title.
        summary: Check Run output summary.
        name: Name displayed for the Check Run.

    Returns:
        The GitHub Check Run response as a dictionary.

    Raises:
        ValueError: If the conclusion is not valid.
        requests.HTTPError: If GitHub returns an unsuccessful response.
        requests.RequestException: If the request fails.
    """

    # Validate the Check Run conclusion.
    if conclusion not in ALLOWED_CONCLUSIONS:
        raise ValueError(
            f"Invalid Check Run conclusion: {conclusion}"
        )

    # GitHub Check Runs API endpoint.
    url = (
        f"{GITHUB_API_URL}/repos/"
        f"{owner}/{repo}/check-runs"
    )

    # Create the Check Run.
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

    # Log API errors before raising the exception.
    if not response.ok:
        logger.error(
            "GitHub Check Run API error. "
            "Status: %s, Response: %s",
            response.status_code,
            response.text,
        )

    response.raise_for_status()

    # Parse the GitHub response.
    check_run = response.json()

    # Log successful Check Run creation.
    logger.info(
        "Created Check Run: %s (ID: %s, Conclusion: %s)",
        check_run.get("name"),
        check_run.get("id"),
        check_run.get("conclusion"),
    )

    return check_run