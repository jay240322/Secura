import hashlib
import hmac
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from secura.github_app.auth import (
    create_installation_token,
    get_repository_file_content,
    get_pull_request_files,
    create_app_jwt,
)
from secura.github_app.checks import (
    create_check_run,
    update_check_run,
    post_pull_request_comment,
)
from app.core.config import settings

logger = logging.getLogger("secura.github_service")
GITHUB_API_URL = "https://api.github.com"


def verify_webhook_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """Validate GitHub webhook HMAC SHA256 signature."""
    webhook_secret = os.getenv("SECURA_WEBHOOK_SECRET", settings.SECURA_WEBHOOK_SECRET)
    if not webhook_secret:
        logger.warning("SECURA_WEBHOOK_SECRET is not configured")
        return False

    digest = hmac.new(
        webhook_secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    expected_signature = f"sha256={digest}"
    return hmac.compare_digest(expected_signature, signature_header)


def get_installation_repositories(installation_id: int) -> List[Dict[str, Any]]:
    """Fetch repositories accessible to the GitHub App installation."""
    try:
        token = create_installation_token(installation_id)
        url = f"{GITHUB_API_URL}/installation/repositories"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={"per_page": 100},
            timeout=15,
        )
        if not response.ok:
            logger.error(
                "GitHub installation repositories error for %s. Status: %s, Response: %s",
                installation_id,
                response.status_code,
                response.text,
            )
        response.raise_for_status()
        data = response.json()
        return data.get("repositories", [])
    except Exception as exc:
        logger.error("Failed to fetch installation repositories: %s", exc)
        return []


def trigger_check_run(
    installation_id: int,
    owner: str,
    repo: str,
    head_sha: str,
    status: str = "in_progress",
    findings: Optional[List[Dict[str, Any]]] = None,
    result: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Create or update GitHub Check Run using existing Secura checks module."""
    try:
        token = create_installation_token(installation_id)
        return create_check_run(
            installation_token=token,
            owner=owner,
            repo=repo,
            head_sha=head_sha,
            status=status,
            findings=findings,
            result=result,
        )
    except Exception as exc:
        logger.error("Failed to trigger GitHub Check Run: %s", exc)
        return None


def trigger_pr_comment(
    installation_id: int,
    owner: str,
    repo: str,
    pull_number: int,
    findings: Optional[List[Dict[str, Any]]] = None,
    result: Optional[Dict[str, Any]] = None,
    base_branch: str = "main",
) -> Optional[Dict[str, Any]]:
    """Post or update an informative security comment directly on the GitHub Pull Request."""
    try:
        token = create_installation_token(installation_id)
        return post_pull_request_comment(
            installation_token=token,
            owner=owner,
            repo=repo,
            pull_number=pull_number,
            findings=findings,
            result=result,
            base_branch=base_branch,
        )
    except Exception as exc:
        logger.error("Failed to post GitHub PR comment on #%s: %s", pull_number, exc)
        return None


def get_open_pull_requests(
    installation_id: int,
    owner: str,
    repo: str,
) -> List[Dict[str, Any]]:
    """Fetch open pull requests for a repository via GitHub App installation token."""
    try:
        token = create_installation_token(installation_id)
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={"state": "open", "per_page": 20},
            timeout=15,
        )
        if response.ok:
            return response.json()
        return []
    except Exception as exc:
        logger.error("Failed to list open PRs for %s/%s: %s", owner, repo, exc)
        return []



def get_app_installations() -> List[Dict[str, Any]]:
    """Fetch all installations of the GitHub App using the App JWT."""
    try:
        app_jwt = create_app_jwt()
        url = f"{GITHUB_API_URL}/app/installations"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={"per_page": 100},
            timeout=15,
        )
        if not response.ok:
            logger.error(
                "GitHub App installations fetch error. Status: %s, Response: %s",
                response.status_code,
                response.text,
            )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logger.error("Failed to fetch app installations: %s", exc)
        return []


def sync_github_app_repositories(db, user) -> List[Any]:
    """
    Directly query GitHub App API to discover all installations and repositories
    granted to Secura, and import/update them in the database for the user.
    """
    from app.models.installation import GitHubInstallation
    from app.models.repository import Repository

    installations = get_app_installations()
    if not installations:
        logger.info("No GitHub App installations found on GitHub.")
        db_repos = db.query(Repository).all()
        for r in db_repos:
            if r.user_id != user.id:
                r.user_id = user.id
        if db_repos:
            try:
                db.commit()
            except Exception:
                db.rollback()
        return db.query(Repository).filter(Repository.user_id == user.id).all()

    synced_repos = []

    for inst_data in installations:
        inst_id = inst_data.get("id")
        account = inst_data.get("account", {})
        account_name = account.get("login", "")
        avatar_url = account.get("avatar_url", "")

        # Auto-link github_username and avatar if user doesn't have one
        try:
            if not user.github_username and account_name:
                user.github_username = account_name
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
            db.commit()
        except Exception:
            db.rollback()

        # Create or update installation record for this user
        inst_record = (
            db.query(GitHubInstallation)
            .filter(GitHubInstallation.github_installation_id == inst_id)
            .first()
        )
        try:
            if not inst_record:
                inst_record = GitHubInstallation(
                    user_id=user.id,
                    github_installation_id=inst_id,
                    account_name=account_name,
                    account_avatar_url=avatar_url,
                )
                db.add(inst_record)
                db.commit()
                db.refresh(inst_record)
            else:
                inst_record.user_id = user.id
                inst_record.account_name = account_name
                if avatar_url:
                    inst_record.account_avatar_url = avatar_url
                db.commit()
                db.refresh(inst_record)
        except Exception as e:
            db.rollback()
            logger.warning("Error saving installation %s: %s", inst_id, e)
            inst_record = (
                db.query(GitHubInstallation)
                .filter(GitHubInstallation.github_installation_id == inst_id)
                .first()
            )

        if not inst_record:
            continue

        # Fetch all repositories granted to this installation
        repos_data = get_installation_repositories(inst_id)
        for r in repos_data:
            repo_id = r.get("id")
            full_name = r.get("full_name")
            if not full_name:
                continue
            name = r.get("name") or full_name.split("/")[-1]
            owner = r.get("owner", {}).get("login", account_name)
            default_branch = r.get("default_branch", "main")
            is_private = bool(r.get("private", False))
            html_url = r.get("html_url") or f"https://github.com/{full_name}"

            try:
                existing_repo = (
                    db.query(Repository)
                    .filter(
                        (Repository.full_name == full_name)
                        | (Repository.github_repo_id == repo_id)
                    )
                    .first()
                )
                if existing_repo:
                    existing_repo.user_id = user.id
                    existing_repo.installation_id = inst_record.id
                    existing_repo.github_repo_id = repo_id
                    existing_repo.name = name
                    existing_repo.full_name = full_name
                    existing_repo.owner = owner
                    existing_repo.default_branch = default_branch
                    existing_repo.is_private = is_private
                    existing_repo.html_url = html_url
                    existing_repo.is_monitored = True
                    db.commit()
                    db.refresh(existing_repo)
                    synced_repos.append(existing_repo)
                else:
                    new_repo = Repository(
                        installation_id=inst_record.id,
                        user_id=user.id,
                        github_repo_id=repo_id,
                        name=name,
                        full_name=full_name,
                        owner=owner,
                        default_branch=default_branch,
                        is_private=is_private,
                        is_monitored=True,
                        html_url=html_url,
                    )
                    db.add(new_repo)
                    db.commit()
                    db.refresh(new_repo)
                    synced_repos.append(new_repo)
            except Exception as exc:
                db.rollback()
                logger.warning("Error saving repository %s: %s", full_name, exc)

    logger.info("Synced %d repositories for user %s", len(synced_repos), user.email)
    return synced_repos


def get_user_available_github_repositories(user, db) -> List[Dict[str, Any]]:
    """
    Fetch all repositories accessible via GitHub App installations for this user,
    plus any public repos for their GitHub username, annotated with whether they are
    already monitored in Secura.
    """
    from app.models.repository import Repository

    existing_repos = db.query(Repository).filter(Repository.user_id == user.id).all()
    existing_full_names = {
        (r.full_name or "").lower(): r
        for r in existing_repos
        if r.full_name
    }

    repos_by_full_name: Dict[str, Dict[str, Any]] = {}

    # 1. Fetch from GitHub App Installations
    installations = get_app_installations()

    for inst_data in installations:
        inst_id = inst_data.get("id")
        account = inst_data.get("account", {})
        account_name = account.get("login", "")

        gh_repos = get_installation_repositories(inst_id)
        for r in gh_repos:
            fn = r.get("full_name")
            if not fn:
                continue
            fn_key = fn.lower()
            repos_by_full_name[fn_key] = {
                "github_repo_id": r.get("id"),
                "name": r.get("name") or fn.split("/")[-1],
                "full_name": fn,
                "owner": r.get("owner", {}).get("login", account_name),
                "default_branch": r.get("default_branch", "main"),
                "is_private": bool(r.get("private", False)),
                "html_url": r.get("html_url") or f"https://github.com/{fn}",
                "description": r.get("description") or "",
                "installation_id": inst_id,
                "already_monitored": fn_key in existing_full_names,
            }

    # 2. Also query public repos from api.github.com/users/{username}/repos if username is known
    target_username = user.github_username
    if not target_username and installations:
        target_username = installations[0].get("account", {}).get("login")

    if target_username:
        try:
            resp = requests.get(
                f"{GITHUB_API_URL}/users/{target_username}/repos",
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Secura-Security-Scanner",
                },
                params={"per_page": 100, "sort": "updated"},
                timeout=10,
            )
            if resp.status_code == 200:
                for r in resp.json():
                    fn = r.get("full_name")
                    if not fn:
                        continue
                    fn_key = fn.lower()
                    if fn_key not in repos_by_full_name:
                        repos_by_full_name[fn_key] = {
                            "github_repo_id": r.get("id"),
                            "name": r.get("name") or fn.split("/")[-1],
                            "full_name": fn,
                            "owner": r.get("owner", {}).get("login", target_username),
                            "default_branch": r.get("default_branch", "main"),
                            "is_private": bool(r.get("private", False)),
                            "html_url": r.get("html_url") or f"https://github.com/{fn}",
                            "description": r.get("description") or "",
                            "installation_id": None,
                            "already_monitored": fn_key in existing_full_names,
                        }
        except Exception as exc:
            logger.warning("Could not fetch user public repos from GitHub: %s", exc)

    return list(repos_by_full_name.values())

