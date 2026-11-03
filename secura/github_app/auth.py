
import logging
import os
from pathlib import Path
import time
import jwt
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("secura.github_app.auth")
GITHUB_API_URL = "https://api.github.com"


def create_app_jwt() -> str:
    """Create a short-lived JWT for GitHub App authentication."""

    app_id = os.environ.get("GITHUB_APP_ID")
    private_key_path = os.environ.get("GITHUB_PRIVATE_KEY_PATH")

    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not configured")

    if not private_key_path:
        raise RuntimeError("GITHUB_PRIVATE_KEY_PATH is not configured")

    key_file_path = Path(private_key_path)
    if not key_file_path.is_file():
        # Check relative to repository root (auth.py -> github_app -> secura -> root)
        repo_root = Path(__file__).resolve().parent.parent.parent
        candidates = [
            repo_root / private_key_path,
            repo_root / ".secrets" / Path(private_key_path).name,
            Path.cwd() / private_key_path,
            Path("/home/jay/projects/Secura/.secrets/github-app-private-key.pem"),
            Path(r"\\wsl.localhost\Ubuntu\home\jay\projects\Secura\.secrets\github-app-private-key.pem"),
        ]
        found = False
        for candidate in candidates:
            if candidate.is_file():
                key_file_path = candidate
                found = True
                break
        if not found:
            raise FileNotFoundError(
                f"GitHub App private key not found at {private_key_path} or {candidates}"
            )

    with open(key_file_path, "r", encoding="utf-8") as key_file:
        private_key = key_file.read()

    now = int(time.time())

    try:
        iss_val: int | str = int(app_id)
    except (ValueError, TypeError):
        iss_val = app_id

    payload = {
        "iat": now - 60,
        "exp": now + 9 * 60,
        "iss": iss_val,
    }

    return jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
    )


def create_installation_token(installation_id: int) -> str:
    """Exchange an App JWT for an installation access token."""

    app_jwt = create_app_jwt()

    url = (
        f"{GITHUB_API_URL}/app/installations/"
        f"{installation_id}/access_tokens"
    )

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=15,
    )

    if not response.ok:
        logger.error(
            "GitHub token exchange failed for installation %s. Status: %s, Response: %s",
            installation_id,
            response.status_code,
            response.text,
        )

    response.raise_for_status()

    token_data = response.json()
    access_token = token_data.get("token")

    if not access_token:
        raise RuntimeError(
            "GitHub did not return an installation access token"
        )

    return access_token


def get_pull_request_files(
    installation_token: str,
    owner: str,
    repo: str,
    pull_number: int,
) -> list[dict]:
    """Fetch files changed in a GitHub pull request."""

    url = (
        f"{GITHUB_API_URL}/repos/{owner}/{repo}/"
        f"pulls/{pull_number}/files"
    )

    files = []
    page = 1

    while True:
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {installation_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={
                "per_page": 100,
                "page": page,
            },
            timeout=15,
        )

        response.raise_for_status()

        page_files = response.json()

        if not page_files:
            break

        files.extend(page_files)

        if len(page_files) < 100:
            break

        page += 1

    return files

def get_repository_file_content(
    installation_token: str,
    owner: str,
    repo: str,
    path: str,
    ref: str,
) -> str:
    """Fetch a repository file's text content at a specific Git ref."""

    url = (
        f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}"
    )

    response = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {installation_token}",
            "Accept": "application/vnd.github.raw+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        params={"ref": ref},
        timeout=15,
    )

    response.raise_for_status()

    return response.text