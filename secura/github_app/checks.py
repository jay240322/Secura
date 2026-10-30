import requests

from secura.github_app.auth import GITHUB_API_URL


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    name: str = "Secura Security Scan",
    status: str = "completed",
    conclusion: str = "success",
    title: str = "Security scan passed",
    summary: str = "Secura did not find policy violations.",
):
    """Create a GitHub Check Run for a commit."""

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
            "status": status,
            "conclusion": conclusion,
            "output": {
                "title": title,
                "summary": summary,
            },
        },
        timeout=15,
    )

    response.raise_for_status()

    return response.json()