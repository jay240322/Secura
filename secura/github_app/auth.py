
import datetime
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


def log_debug(msg: str):
    try:
        debug_file = Path("/home/jay/projects/Secura/sync_debug.log")
        if not debug_file.parent.exists():
            repo_root = Path(__file__).resolve().parent.parent.parent
            debug_file = repo_root / "sync_debug.log"
        with open(debug_file, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


def create_app_jwt() -> str:
    """Create a short-lived JWT for GitHub App authentication."""

    app_id = os.environ.get("GITHUB_APP_ID")
    pem_location = os.environ.get("GITHUB_PRIVATE_KEY_PATH")

    if not app_id:
        try:
            from app.core.config import settings
            app_id = settings.GITHUB_APP_ID
        except Exception:
            pass

    if not pem_location:
        try:
            from app.core.config import settings
            pem_location = getattr(settings, "GITHUB_PRIVATE_KEY_PATH", None)
        except Exception:
            pass

    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not configured")

    if not pem_location:
        raise RuntimeError("GITHUB_PRIVATE_KEY_PATH is not configured")

    key_file_path = Path(pem_location)
    if not key_file_path.is_file():
        # Check relative to repository root (auth.py -> github_app -> secura -> root)
        repo_root = Path(__file__).resolve().parent.parent.parent
        candidates = [
            repo_root / pem_location,
            repo_root / ".secrets" / Path(pem_location).name,
            Path.cwd() / pem_location,
            Path.cwd() / ".secrets" / Path(pem_location).name,
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
                f"GitHub App private key not found at {pem_location} or {candidates}"
            )

    with open(key_file_path, "r", encoding="utf-8") as key_file:
        private_key = key_file.read()

    now = int(time.time())

    # PyJWT strictly requires 'iss' (Issuer) to be a string.
    iss_val = str(app_id).strip()

    # GitHub requires JWT exp to be strictly <= 10 minutes (600s) from iat.
    # We set iat to 60s in past for clock drift and exp to 500s (~8.3 min), strictly within the 600s limit.
    payload = {
        "iat": now - 60,
        "exp": now + 500,
        "iss": iss_val,
    }

    log_debug(f"Creating App JWT: iss={iss_val}, key_file={key_file_path}")
    encoded_jwt = jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
    )
    return encoded_jwt


def create_installation_token(installation_id: int) -> str:
    """Exchange an App JWT for an installation access token."""

    app_jwt = create_app_jwt()

    url = (
        f"{GITHUB_API_URL}/app/installations/"
        f"{installation_id}/access_tokens"
    )

    log_debug(f"POST {url} to exchange App JWT for installation access token...")
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Secura-Security-Scanner",
        },
        timeout=15,
    )

    log_debug(f"POST {url} response: status={response.status_code}, body={response.text[:300]}")

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
    installation_token: str | None,
    owner: str,
    repo: str,
    pull_number: int,
) -> list[dict]:
    """Fetch files changed in a GitHub pull request."""

    url = (
        f"{GITHUB_API_URL}/repos/{owner}/{repo}/"
        f"pulls/{pull_number}/files"
    )

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if installation_token:
        headers["Authorization"] = f"Bearer {installation_token}"

    files = []
    page = 1

    while True:
        response = requests.get(
            url,
            headers=headers,
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
    installation_token: str | None,
    owner: str,
    repo: str,
    path: str,
    ref: str,
) -> str:
    """Fetch a repository file's text content at a specific Git ref."""

    url = (
        f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}"
    )

    headers = {
        "Accept": "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if installation_token:
        headers["Authorization"] = f"Bearer {installation_token}"

    response = requests.get(
        url,
        headers=headers,
        params={"ref": ref},
        timeout=15,
    )

    response.raise_for_status()

    return response.text