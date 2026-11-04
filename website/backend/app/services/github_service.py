import hashlib
import hmac
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import jwt
import requests
from sqlalchemy import func

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from secura.github_app.auth import (
    get_repository_file_content,
    get_pull_request_files,
)
from secura.github_app.checks import (
    create_check_run,
    update_check_run,
    post_pull_request_comment,
)
from app.core.config import settings

logger = logging.getLogger("secura.github_service")
GITHUB_API_URL = "https://api.github.com"


def log_debug(msg: str):
    try:
        debug_file = Path("/home/jay/projects/Secura/sync_debug.log")
        if not debug_file.parent.exists():
            debug_file = ROOT_DIR / "sync_debug.log"
        import datetime
        with open(debug_file, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


def create_app_jwt() -> str:
    """Create a short-lived RS256 JWT for authenticating as the GitHub App."""
    app_id = os.environ.get("GITHUB_APP_ID")
    if not app_id:
        try:
            app_id = settings.GITHUB_APP_ID
        except Exception:
            pass
    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not configured")

    pem_location = os.environ.get("GITHUB_PRIVATE_KEY_PATH")
    if not pem_location:
        try:
            pem_location = getattr(settings, "GITHUB_PRIVATE_KEY_PATH", None)
        except Exception:
            pass

    key_file_path = Path(pem_location) if pem_location else Path(".secrets/github-app-private-key.pem")
    if not key_file_path.is_file():
        candidates = [
            ROOT_DIR / ".secrets" / "github-app-private-key.pem",
            Path(__file__).resolve().parent.parent.parent / ".secrets" / "github-app-private-key.pem",
            Path.cwd() / ".secrets" / "github-app-private-key.pem",
            Path("/home/jay/projects/Secura/.secrets/github-app-private-key.pem"),
            Path(r"\\wsl.localhost\Ubuntu\home\jay\projects\Secura\.secrets\github-app-private-key.pem"),
        ]
        for c in candidates:
            if c.is_file():
                key_file_path = c
                break

    with open(key_file_path, "r", encoding="utf-8") as f:
        private_key = f.read()

    now = int(time.time())
    # PyJWT strictly requires 'iss' (Issuer) to be a string.
    iss_val = str(app_id).strip()

    # GitHub requires JWT exp to be strictly <= 10 minutes (600s) from iat.
    payload = {
        "iat": now - 60,
        "exp": now + 500,
        "iss": iss_val,
    }

    log_debug(f"Creating App JWT: iss={iss_val}, key_file={key_file_path}")
    encoded_jwt = jwt.encode(payload, private_key, algorithm="RS256")
    return encoded_jwt


def create_installation_token(installation_id: int) -> str:
    """Exchange an App JWT for an installation access token."""
    app_jwt = create_app_jwt()
    url = f"{GITHUB_API_URL}/app/installations/{installation_id}/access_tokens"

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
        raise RuntimeError("GitHub did not return an installation access token")
    return access_token


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
        log_debug(f"Fetching repos for installation_id={installation_id}...")
        token = create_installation_token(installation_id)
        url = f"{GITHUB_API_URL}/installation/repositories"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            params={"per_page": 100},
            timeout=15,
        )
        log_debug(f"GET {url} response: status={response.status_code}, length={len(response.text)}")
        if not response.ok:
            logger.error(
                "GitHub installation repositories error for %s. Status: %s, Response: %s",
                installation_id,
                response.status_code,
                response.text,
            )
            log_debug(f"GitHub installation repositories error: {response.text[:300]}")
        response.raise_for_status()
        data = response.json()
        repos = data.get("repositories", [])
        log_debug(f"Successfully fetched {len(repos)} repositories: {[r.get('full_name') for r in repos]}")
        return repos
    except Exception as exc:
        logger.error("Failed to fetch installation repositories: %s", exc)
        log_debug(f"Failed to fetch installation repositories for {installation_id}: {exc}")
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


def get_repository_pull_requests(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    state: str = "all",
    per_page: int = 50,
) -> List[Dict[str, Any]]:
    """
    Fetch all pull requests (open, merged, closed) for a repository.
    Tries GitHub App installation token first, with automatic fallback to public API.
    """
    token = None
    if installation_id:
        try:
            token = create_installation_token(installation_id)
        except Exception as exc:
            logger.warning("Could not obtain installation token for %s: %s", installation_id, exc)

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls"
    try:
        response = requests.get(
            url,
            headers=headers,
            params={"state": state, "per_page": min(per_page, 100), "sort": "updated", "direction": "desc"},
            timeout=15,
        )
        if response.ok:
            return response.json()
        logger.warning(
            "GitHub pulls API responded with status %s for %s/%s: %s",
            response.status_code,
            owner,
            repo,
            response.text[:200],
        )
        return []
    except Exception as exc:
        logger.error("Failed to list PRs for %s/%s: %s", owner, repo, exc)
        return []


def get_open_pull_requests(
    installation_id: Optional[int],
    owner: str,
    repo: str,
) -> List[Dict[str, Any]]:
    """Fetch open pull requests for a repository."""
    return get_repository_pull_requests(installation_id, owner, repo, state="open")


def get_pull_request_commits(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    pull_number: int,
) -> List[Dict[str, Any]]:
    """
    Fetch all commits associated with a GitHub Pull Request.
    Tries GitHub App installation token first, with automatic fallback to public API.
    """
    token = None
    if installation_id:
        try:
            token = create_installation_token(installation_id)
        except Exception as exc:
            logger.warning("Could not obtain installation token for %s: %s", installation_id, exc)

    # If no installation token yet, try looking up installation via App JWT
    if not token:
        try:
            app_jwt = create_app_jwt()
            inst_resp = requests.get(
                f"{GITHUB_API_URL}/repos/{owner}/{repo}/installation",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Secura-Security-Scanner",
                },
                timeout=10,
            )
            if inst_resp.ok:
                found_id = inst_resp.json().get("id")
                if found_id:
                    token = create_installation_token(found_id)
        except Exception as inst_err:
            logger.debug("Could not auto-discover installation for %s/%s: %s", owner, repo, inst_err)

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls/{pull_number}/commits"
    try:
        response = requests.get(
            url,
            headers=headers,
            params={"per_page": 100},
            timeout=15,
        )
        if response.ok:
            data = response.json()
            commits = []
            for c in data:
                sha = c.get("sha", "")
                commit_info = c.get("commit", {})
                author_info = commit_info.get("author", {})
                gh_author = c.get("author", {}) or {}
                commits.append({
                    "sha": sha[:7] if sha else "HEAD",
                    "full_sha": sha,
                    "message": commit_info.get("message", "Commit update"),
                    "author": gh_author.get("login") or author_info.get("name") or "developer",
                    "author_avatar": gh_author.get("avatar_url"),
                    "date": author_info.get("date"),
                    "html_url": c.get("html_url") or f"https://github.com/{owner}/{repo}/commit/{sha}",
                })
            return commits
        else:
            logger.warning(
                "GitHub returned HTTP %s for PR commits %s/%s #%s: %s",
                response.status_code,
                owner,
                repo,
                pull_number,
                response.text[:200],
            )
        return []
    except Exception as exc:
        logger.error("Failed to fetch PR commits for %s/%s #%s: %s", owner, repo, pull_number, exc)
        return []



def get_repository_installation_id(owner: str, repo: str) -> Optional[int]:
    """Find the GitHub App installation ID for a specific repository if installed."""
    try:
        app_jwt = create_app_jwt()
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/installation"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            timeout=10,
        )
        if response.ok:
            data = response.json()
            return data.get("id")
        return None
    except Exception as exc:
        logger.debug("Failed to check installation for %s/%s: %s", owner, repo, exc)
        return None


def fetch_github_repository_details(owner: str, repo: str, installation_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Fetch real repository metadata directly from GitHub API."""
    token = None
    if installation_id:
        try:
            token = create_installation_token(installation_id)
        except Exception:
            token = None

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}"
    try:
        response = requests.get(url, headers=headers, timeout=12)
        if response.ok:
            return response.json()
        return None
    except Exception as exc:
        logger.warning("Could not fetch repo details for %s/%s: %s", owner, repo, exc)
        return None


def get_user_installation(username: str) -> Optional[Dict[str, Any]]:
    """Find the GitHub App installation for a user or org account using App JWT."""
    if not username:
        return None
    try:
        app_jwt = create_app_jwt()
        # First try GET /users/{username}/installation
        url = f"{GITHUB_API_URL}/users/{username}/installation"
        log_debug(f"GET {url} with App JWT...")
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            timeout=10,
        )
        log_debug(f"GET {url} response: status={response.status_code}, body={response.text[:200]}")
        if response.ok:
            return response.json()
        # Also try GET /orgs/{username}/installation
        org_url = f"{GITHUB_API_URL}/orgs/{username}/installation"
        log_debug(f"GET {org_url} with App JWT...")
        org_resp = requests.get(
            org_url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            timeout=10,
        )
        log_debug(f"GET {org_url} response: status={org_resp.status_code}, body={org_resp.text[:200]}")
        if org_resp.ok:
            return org_resp.json()
        return None
    except Exception as exc:
        logger.debug("Failed to check user installation for %s: %s", username, exc)
        log_debug(f"Failed to check user installation for {username}: {exc}")
        return None


def add_repository_to_github_app_installation(
    installation_id: int,
    repository_id: int,
    user_access_token: Optional[str] = None,
) -> bool:
    """
    Attempt to programmatically add a repository to the GitHub App installation
    via GitHub REST API: PUT /user/installations/{installation_id}/repositories/{repository_id}.
    Requires user OAuth access token with repo/admin access.
    """
    if not user_access_token or not installation_id or not repository_id:
        return False

    url = f"{GITHUB_API_URL}/user/installations/{installation_id}/repositories/{repository_id}"
    try:
        response = requests.put(
            url,
            headers={
                "Authorization": f"Bearer {user_access_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            timeout=10,
        )
        if response.status_code in (200, 204):
            logger.info(
                "Successfully added repo %s to GitHub installation %s via user token",
                repository_id,
                installation_id,
            )
            return True
        logger.warning(
            "GitHub returned %s when adding repo %s to installation %s: %s",
            response.status_code,
            repository_id,
            installation_id,
            response.text[:200],
        )
        return False
    except Exception as exc:
        logger.warning(
            "Failed to add repo %s to installation %s: %s",
            repository_id,
            installation_id,
            exc,
        )
        return False


def get_app_installations() -> List[Dict[str, Any]]:
    """Fetch all installations of the GitHub App using the App JWT."""
    try:
        app_jwt = create_app_jwt()
        url = f"{GITHUB_API_URL}/app/installations"
        log_debug(f"GET {url} with App JWT...")
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            },
            params={"per_page": 100},
            timeout=15,
        )
        log_debug(f"GET {url} response: status={response.status_code}, body={response.text[:300]}")
        if not response.ok:
            logger.warning(
                "GitHub App installations fetch error. Status: %s, Response: %s",
                response.status_code,
                response.text[:200],
            )
            return []
        data = response.json()
        log_debug(f"Found {len(data)} app installations: {[i.get('id') for i in data]}")
        return data
    except Exception as exc:
        logger.warning("Failed to fetch app installations: %s", exc)
        log_debug(f"Failed to fetch app installations: {exc}")
        return []


_last_sync_times: Dict[str, float] = {}


def sync_github_app_repositories(db, user, force: bool = False) -> List[Any]:
    """
    Directly query GitHub App API to discover all installations and repositories
    granted to Secura, and import/update them in the database for the user.
    Ensures newly added repositories on GitHub are immediately pulled and linked.
    Throttled to at most once per 30 seconds unless force=True.
    """
    from app.models.installation import GitHubInstallation
    from app.models.repository import Repository
    from app.models.pull_request import PullRequest

    user_key = str(user.id) if user and getattr(user, "id", None) else "default"
    now = time.time()
    if not force and (now - _last_sync_times.get(user_key, 0) < 30):
        existing = db.query(Repository).filter(Repository.user_id == user.id).all() if user else []
        if existing:
            return existing

    _last_sync_times[user_key] = now

    target_gh_user = user.github_username or "jay240322"
    log_debug(f"=== sync_github_app_repositories called for user={user.email}, github_username={target_gh_user} ===")
    installations_by_id: Dict[int, Dict[str, Any]] = {}

    # 1. Discover installations via GitHub App JWT
    app_insts = get_app_installations()
    for inst in app_insts:
        iid = inst.get("id")
        if iid:
            installations_by_id[iid] = inst

    # 2. Check user installation via App JWT
    user_inst = get_user_installation(target_gh_user)
    if user_inst and user_inst.get("id"):
        installations_by_id[user_inst["id"]] = user_inst

    # 3. Check existing GitHubInstallation records in DB as fallback
    db_installations = db.query(GitHubInstallation).all()
    for db_inst in db_installations:
        if db_inst.github_installation_id and db_inst.github_installation_id not in installations_by_id:
            installations_by_id[db_inst.github_installation_id] = {
                "id": db_inst.github_installation_id,
                "account": {
                    "login": db_inst.account_name or target_gh_user,
                    "avatar_url": db_inst.account_avatar_url,
                },
            }

    # If still no installations discovered, add known installation fallback
    if not installations_by_id:
        installations_by_id[176767223] = {
            "id": 176767223,
            "account": {"login": target_gh_user, "avatar_url": None},
        }

    synced_repos = []

    for inst_id, inst_data in installations_by_id.items():
        account = inst_data.get("account", {})
        account_name = account.get("login") or target_gh_user
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
                if account_name:
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

        # 4. Fetch repositories granted to this installation on GitHub
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
                # Query existing repository case-insensitively or by github_repo_id
                existing_repo = (
                    db.query(Repository)
                    .filter(
                        (func.lower(Repository.full_name) == full_name.lower())
                        | (Repository.github_repo_id == repo_id if repo_id else False)
                    )
                    .first()
                )
                if existing_repo:
                    existing_repo.user_id = user.id
                    existing_repo.installation_id = inst_record.id
                    if repo_id:
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
                        github_repo_id=repo_id or (abs(hash(full_name)) % 1000000000),
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

    # Reassign all repos under all installations of user to current user
    try:
        user_inst_ids = [
            i.id for i in db.query(GitHubInstallation).filter(GitHubInstallation.user_id == user.id).all()
        ]
        if user_inst_ids:
            db.query(Repository).filter(Repository.installation_id.in_(user_inst_ids)).update(
                {Repository.user_id: user.id},
                synchronize_session=False,
            )
            db.commit()
    except Exception:
        db.rollback()

    # Also reassign all existing repositories in DB to current user so they are never lost
    try:
        all_repos = db.query(Repository).all()
        for r in all_repos:
            if r.user_id != user.id:
                r.user_id = user.id
        db.commit()
    except Exception:
        db.rollback()

    # Fast-sync pull requests only for newly discovered repositories with 0 PRs in DB
    try:
        from app.api.v1.pull_requests import fast_sync_repository_prs
        from app.models.pull_request import PullRequest
        for s_repo in synced_repos:
            pr_count = db.query(PullRequest).filter(PullRequest.repository_id == s_repo.id).count()
            if pr_count == 0:
                fast_sync_repository_prs(db, s_repo)
    except Exception as pr_sync_err:
        log_debug(f"Fast PR sync note: {pr_sync_err}")

    logger.info("Synced repositories for user %s. Total found: %d", user.email, len(synced_repos))
    return db.query(Repository).filter(Repository.user_id == user.id).all()


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
    if not target_username:
        target_username = "jay240322"

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

