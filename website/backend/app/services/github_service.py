import hashlib
import hmac
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import jwt
import requests
from requests.adapters import HTTPAdapter
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

# Shared HTTP session with connection pooling to avoid repeated TLS handshakes to api.github.com
_GH_SESSION = requests.Session()
_GH_ADAPTER = HTTPAdapter(pool_connections=20, pool_maxsize=20)
_GH_SESSION.mount("https://", _GH_ADAPTER)
_GH_SESSION.mount("http://", _GH_ADAPTER)

_APP_JWT_CACHE: Optional[Tuple[str, float]] = None


def log_debug(msg: str):
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return
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
    """Create a short-lived RS256 JWT for authenticating as the GitHub App (cached ~5 min)."""
    global _APP_JWT_CACHE
    now = int(time.time())
    if _APP_JWT_CACHE and now < _APP_JWT_CACHE[1]:
        return _APP_JWT_CACHE[0]

    app_id = os.environ.get("GITHUB_APP_ID")
    if not app_id:
        try:
            app_id = settings.GITHUB_APP_ID
        except Exception:
            pass
    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not configured")

    raw_key_env = os.environ.get("GITHUB_APP_PRIVATE_KEY") or os.environ.get("GITHUB_PRIVATE_KEY")
    if raw_key_env:
        private_key = raw_key_env.replace("\\n", "\n").strip()
        key_file_path = "env:GITHUB_APP_PRIVATE_KEY"
    else:
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
    _APP_JWT_CACHE = (encoded_jwt, now + 300)
    return encoded_jwt


_INSTALL_CACHE: Dict[int, Any] = {}


def create_installation_token(installation_id: int) -> str:
    """Exchange an App JWT for an installation access token (cached for efficiency)."""
    now = time.time()
    cached = _INSTALL_CACHE.get(installation_id)
    if cached:
        tok_val, exp_time = cached
        if now < exp_time - 120:  # 2 minute buffer
            return tok_val

    app_jwt = create_app_jwt()
    url = f"{GITHUB_API_URL}/app/installations/{installation_id}/access_tokens"

    log_debug(f"POST {url} to exchange App JWT for installation access token...")
    response = _GH_SESSION.post(
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

    # Cache token for 50 minutes (GitHub tokens last 60 minutes)
    _INSTALL_CACHE[installation_id] = (access_token, now + 3000)
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
        response = _GH_SESSION.get(
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
    name: str = "Secura Security Gate",
    details_url: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Create or update GitHub Check Run using existing Secura checks module."""
    try:
        token = create_installation_token(installation_id)
        if not details_url:
            dashboard_base = os.environ.get("SECURA_DASHBOARD_URL", "https://secura-frontend.vercel.app").rstrip("/")
            details_url = f"{dashboard_base}/findings?repo={owner}/{repo}&sha={head_sha}"
        return create_check_run(
            installation_token=token,
            owner=owner,
            repo=repo,
            head_sha=head_sha,
            status=status,
            findings=findings,
            result=result,
            name=name,
            details_url=details_url,
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


_DISCOVERED_INST_CACHE: Dict[Tuple[str, str], Tuple[Optional[int], float]] = {}


def _get_github_auth_headers(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    user_token: Optional[str] = None,
) -> Dict[str, str]:
    """Obtain standard headers for GitHub API requests with auto-discovery of installation tokens."""
    token = None
    if installation_id:
        try:
            token = create_installation_token(installation_id)
        except Exception as exc:
            logger.warning("Could not obtain installation token for %s: %s", installation_id, exc)

    if not token and user_token:
        token = user_token

    # Check memory cache for auto-discovered installation ID
    cache_k = (owner.lower(), repo.lower())
    now = time.time()
    if not token:
        cached = _DISCOVERED_INST_CACHE.get(cache_k)
        if cached:
            found_id, exp_t = cached
            if now < exp_t and found_id:
                try:
                    token = create_installation_token(found_id)
                except Exception:
                    pass

    if not token and cache_k not in _DISCOVERED_INST_CACHE:
        try:
            app_jwt = create_app_jwt()
            inst_resp = _GH_SESSION.get(
                f"{GITHUB_API_URL}/repos/{owner}/{repo}/installation",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Secura-Security-Scanner",
                },
                timeout=3,
            )
            if inst_resp.ok:
                found_id = inst_resp.json().get("id")
                if found_id:
                    _DISCOVERED_INST_CACHE[cache_k] = (found_id, time.time() + 3600)
                    token = create_installation_token(found_id)
            else:
                _DISCOVERED_INST_CACHE[cache_k] = (None, time.time() + 300)
        except Exception as inst_err:
            logger.debug("Could not auto-discover installation for %s/%s: %s", owner, repo, inst_err)
            _DISCOVERED_INST_CACHE[cache_k] = (None, time.time() + 300)

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Secura-Security-Scanner",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def get_repository_pull_requests(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    state: str = "all",
    per_page: int = 50,
    user_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch all pull requests (open, merged, closed) for a repository.
    Tries GitHub App installation token first, with automatic fallback to public API.
    """
    headers = _get_github_auth_headers(installation_id, owner, repo, user_token=user_token)

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls"
    try:
        response = _GH_SESSION.get(
            url,
            headers=headers,
            params={"state": state, "per_page": min(per_page, 100), "sort": "updated", "direction": "desc"},
            timeout=6,
        )
        if response.ok:
            return response.json()
        if response.status_code in (401, 403) and "Authorization" in headers:
            logger.info("GitHub pulls API returned %s with token for %s/%s; attempting unauthenticated fallback", response.status_code, owner, repo)
            fallback_headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            }
            fallback_resp = _GH_SESSION.get(
                url,
                headers=fallback_headers,
                params={"state": state, "per_page": min(per_page, 100), "sort": "updated", "direction": "desc"},
                timeout=6,
            )
            if fallback_resp.ok:
                return fallback_resp.json()
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
    user_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch open pull requests for a repository."""
    return get_repository_pull_requests(installation_id, owner, repo, state="open", user_token=user_token)


def get_single_pull_request(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    pull_number: int,
    user_token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch live status and metadata for a single pull request from GitHub API.
    """
    headers = _get_github_auth_headers(installation_id, owner, repo, user_token=user_token)
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls/{pull_number}"
    try:
        response = _GH_SESSION.get(url, headers=headers, timeout=5)
        if response.ok:
            return response.json()
        if response.status_code in (401, 403) and "Authorization" in headers:
            fallback_headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            }
            fallback_resp = _GH_SESSION.get(url, headers=fallback_headers, timeout=5)
            if fallback_resp.ok:
                return fallback_resp.json()
        return None
    except Exception as exc:
        logger.debug("Failed to fetch PR #%s for %s/%s: %s", pull_number, owner, repo, exc)
        return None


def get_pull_request_commits(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    pull_number: int,
    user_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch all commits associated with a GitHub Pull Request.
    Tries GitHub App installation token first, with automatic fallback to user token and public API.
    """
    headers = _get_github_auth_headers(installation_id, owner, repo, user_token=user_token)
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls/{pull_number}/commits"
    try:
        response = _GH_SESSION.get(
            url,
            headers=headers,
            params={"per_page": 100},
            timeout=6,
        )
        if response.ok:
            data = response.json()
        elif response.status_code in (401, 403) and "Authorization" in headers:
            logger.info("GitHub PR commits API returned %s with token for %s/%s #%s; attempting unauthenticated fallback", response.status_code, owner, repo, pull_number)
            fallback_headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Secura-Security-Scanner",
            }
            fallback_resp = _GH_SESSION.get(
                url,
                headers=fallback_headers,
                params={"per_page": 100},
                timeout=6,
            )
            if fallback_resp.ok:
                data = fallback_resp.json()
            else:
                return []
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
    except Exception as exc:
        logger.error("Failed to fetch PR commits for %s/%s #%s: %s", owner, repo, pull_number, exc)
        return []


def _make_check_run_finding(
    f_id: str,
    rule_id: str,
    f_path: str,
    line_no: int = 1,
    severity: str = "HIGH",
    risk: Optional[str] = None,
    remediation: Optional[str] = None,
    commit_sha: Optional[str] = None,
) -> Dict[str, Any]:
    """Helper to build standardized finding dictionaries without code duplication."""
    clean_rule = rule_id.strip() if rule_id and rule_id.lower() != "unknown" else "SECRET_DETECTED"
    clean_path = f_path.strip().strip("`") if f_path and f_path.lower() != "unknown" else "source_file"
    if "secura-pr-" in clean_path:
        _, _, remainder = clean_path.partition("secura-pr-")
        if "/" in remainder:
            clean_path = remainder.partition("/")[2]
    if not clean_path or clean_path.lower() == "unknown":
        clean_path = "source_file"

    upper_sev = (severity or "HIGH").upper()
    valid_sev = upper_sev if upper_sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else "HIGH"

    return {
        "id": f_id,
        "rule_id": clean_rule,
        "finding_type": "Secret",
        "severity": valid_sev,
        "file_path": clean_path,
        "line_number": line_no,
        "status": "open",
        "risk": risk or f"Exposed {clean_rule} credential detected in source code",
        "recommendation": remediation or "Remove secret from source code and revoke compromised credentials",
        "commit_sha": commit_sha,
        "detected_in_commit": commit_sha[:7] if commit_sha else None,
        "is_resolved": False,
        "resolved_in_commit": None,
    }


def get_commit_check_runs(
    installation_id: Optional[int],
    owner: str,
    repo: str,
    commit_sha: str,
    user_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch GitHub Check Runs and annotations for a specific commit SHA.
    Enables retrieving detections made by GitHub Actions or GitHub App for historical commits.
    """
    headers = _get_github_auth_headers(installation_id, owner, repo, user_token=user_token)
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/commits/{commit_sha}/check-runs"
    try:
        response = _GH_SESSION.get(url, headers=headers, params={"per_page": 50}, timeout=6)
        if not response.ok:
            return []
        data = response.json()
        runs = []
        for cr in data.get("check_runs", []):
            findings = []
            run_id = cr.get("id")
            output = cr.get("output") or {}
            ann_count = output.get("annotations_count", 0)

            if run_id and (ann_count > 0 or cr.get("conclusion") == "failure"):
                ann_url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/check-runs/{run_id}/annotations"
                try:
                    ann_resp = _GH_SESSION.get(ann_url, headers=headers, params={"per_page": 100}, timeout=10)
                    if ann_resp.ok:
                        for ann in ann_resp.json():
                            level = (ann.get("annotation_level") or "failure").lower()
                            sev = "CRITICAL" if level == "failure" else "HIGH"
                            raw_msg = ann.get("message") or ""
                            ann_title = ann.get("title") or "SECRET_DETECTED"
                            ann_path = ann.get("path") or "source_file"
                            if ann_path.lower() == "unknown":
                                ann_path = "source_file"
                            ann_line = ann.get("start_line") or 1
                            remed = (
                                raw_msg.split("Remediation:")[-1].strip()
                                if "Remediation:" in raw_msg
                                else "Remove secret from source code and revoke compromised credentials"
                            )
                            findings.append(_make_check_run_finding(
                                f_id=f"cr-{run_id}-{ann_line}-{ann_title}",
                                rule_id=ann_title,
                                f_path=ann_path,
                                line_no=ann_line,
                                severity=sev,
                                risk=raw_msg.split("\n")[0] if raw_msg else "Detected sensitive secret in source code",
                                remediation=remed,
                                commit_sha=commit_sha,
                            ))
                except Exception as ann_err:
                    logger.debug("Failed to fetch annotations for check run %s: %s", run_id, ann_err)

                # Fallback: Parse findings directly from check run markdown summary or text
                if not findings and cr.get("conclusion") == "failure":
                    summary_text = (output.get("summary") or "") + "\n" + (output.get("text") or "")
                    lines = [ln.strip() for ln in summary_text.splitlines() if ln.strip()]

                    # Pattern 1: Secura list format: **[CRITICAL] AWS Access Key** in `app/config.py:12` or [HIGH] Hardcoded Credential in path:12
                    for line in lines:
                        clean_ln = line.strip().strip("*").strip()
                        if clean_ln.startswith("[") and " in " in clean_ln:
                            prefix, _, target = clean_ln.partition(" in ")
                            if prefix.startswith("[") and "]" in prefix:
                                sev_str, _, rule_name = prefix[1:].partition("]")
                                target = target.strip().strip("`").strip("*")
                                path_part, _, line_part = target.rpartition(":")
                                line_no = int(line_part) if line_part.isdigit() else 1
                                file_target = path_part if line_part.isdigit() else target
                                rule_clean = rule_name.strip()
                                findings.append(_make_check_run_finding(
                                    f_id=f"cr-parsed-{run_id}-{len(findings) + 1}-{rule_clean}",
                                    rule_id=rule_clean,
                                    f_path=file_target,
                                    line_no=line_no,
                                    severity=sev_str.strip(),
                                    commit_sha=commit_sha,
                                ))

                    # Pattern 2: Table format: | CRITICAL | AWS Access Key | app/config.py:12 |
                    if not findings:
                        for line in lines:
                            if line.startswith("|") and line.endswith("|"):
                                parts = [p.strip() for p in line.split("|")[1:-1]]
                                if len(parts) >= 3 and parts[0].upper() in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                                    sev_str = parts[0].upper()
                                    rule_clean = parts[1]
                                    target = parts[2].strip("`")
                                    path_part, _, line_part = target.rpartition(":")
                                    line_no = int(line_part) if line_part.isdigit() else 1
                                    file_target = path_part if line_part.isdigit() else target
                                    findings.append(_make_check_run_finding(
                                        f_id=f"cr-table-{run_id}-{len(findings) + 1}-{rule_clean}",
                                        rule_id=rule_clean,
                                        f_path=file_target,
                                        line_no=line_no,
                                        severity=sev_str,
                                        commit_sha=commit_sha,
                                    ))

                    # Pattern 3: Key-value pattern (e.g. Rule: AWS Access Key ... File: app/config.py:12)
                    if not findings:
                        cur_rule = None
                        for line in lines:
                            lower = line.lower()
                            if lower.startswith(("rule:", "detector:", "secrettype:")):
                                _, _, val = line.partition(":")
                                cur_rule = val.strip()[:40]
                            elif lower.startswith("file:") and cur_rule:
                                _, _, val = line.partition(":")
                                target = val.strip().strip("`")
                                path_part, _, line_part = target.rpartition(":")
                                line_no = int(line_part) if line_part.isdigit() else 1
                                file_target = path_part if line_part.isdigit() else target
                                findings.append(_make_check_run_finding(
                                    f_id=f"cr-tool-{run_id}-{len(findings) + 1}-{cur_rule}",
                                    rule_id=cur_rule,
                                    f_path=file_target,
                                    line_no=line_no,
                                    severity="CRITICAL",
                                    commit_sha=commit_sha,
                                ))
                                cur_rule = None

                    # Fallback for failed check run
                    if not findings:
                        fallback_title = output.get("title") or cr.get("name") or "Security Gate: Blocked"
                        findings.append(_make_check_run_finding(
                            f_id=f"cr-fallback-{run_id}",
                            rule_id="SECRET_DETECTED",
                            f_path="security-gate",
                            line_no=1,
                            severity="CRITICAL",
                            risk=fallback_title,
                            commit_sha=commit_sha,
                        ))

            runs.append({
                "id": cr.get("id"),
                "name": cr.get("name"),
                "status": cr.get("status"),
                "conclusion": cr.get("conclusion"),
                "title": output.get("title"),
                "summary": output.get("summary"),
                "findings": findings,
            })
        return runs
    except Exception as exc:
        logger.error("Failed to fetch check runs for %s/%s %s: %s", owner, repo, commit_sha, exc)
        return []



def _app_jwt_get(url: str, app_jwt: str, timeout: int = 10) -> Optional[requests.Response]:
    return _GH_SESSION.get(
        url,
        headers={
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Secura-Security-Scanner",
        },
        timeout=timeout,
    )


def get_repository_installation_id(owner: str, repo: str) -> Optional[int]:
    """Find the GitHub App installation ID for a specific repository if installed."""
    try:
        app_jwt = create_app_jwt()
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/installation"
        response = _app_jwt_get(url, app_jwt)
        if response and response.ok:
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
        response = _GH_SESSION.get(url, headers=headers, timeout=12)
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
        response = _app_jwt_get(url, app_jwt)
        log_debug(f"GET {url} response: status={response.status_code if response else 'None'}, body={response.text[:200] if response else ''}")
        if response and response.ok:
            return response.json()
        # Also try GET /orgs/{username}/installation
        org_url = f"{GITHUB_API_URL}/orgs/{username}/installation"
        log_debug(f"GET {org_url} with App JWT...")
        org_resp = _app_jwt_get(org_url, app_jwt)
        log_debug(f"GET {org_url} response: status={org_resp.status_code if org_resp else 'None'}, body={org_resp.text[:200] if org_resp else ''}")
        if org_resp and org_resp.ok:
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
    Programmatically add a repository to the GitHub App installation
    via GitHub REST API: PUT /user/installations/{installation_id}/repositories/{repository_id}.
    Tries user OAuth token first, then GitHub App installation token.
    """
    if not installation_id or not repository_id:
        return False

    url = f"{GITHUB_API_URL}/user/installations/{installation_id}/repositories/{repository_id}"

    # 1. Try with user OAuth token if present
    if user_access_token:
        try:
            log_debug(f"PUT {url} with user OAuth token...")
            response = _GH_SESSION.put(
                url,
                headers={
                    "Authorization": f"Bearer {user_access_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Secura-Security-Scanner",
                },
                timeout=12,
            )
            log_debug(f"PUT {url} (user token) response: status={response.status_code}, body={response.text[:200]}")
            if response.status_code in (200, 204, 304):
                logger.info(
                    "Successfully added repo %s to GitHub installation %s via user token",
                    repository_id,
                    installation_id,
                )
                return True
        except Exception as exc:
            logger.warning("Failed to add repo %s with user token: %s", repository_id, exc)

    # 2. Try with installation access token
    try:
        inst_token = create_installation_access_token(installation_id)
        if inst_token:
            log_debug(f"PUT {url} with installation token...")
            response = _GH_SESSION.put(
                url,
                headers={
                    "Authorization": f"Bearer {inst_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Secura-Security-Scanner",
                },
                timeout=12,
            )
            log_debug(f"PUT {url} (inst token) response: status={response.status_code}, body={response.text[:200]}")
            if response.status_code in (200, 204, 304):
                logger.info(
                    "Successfully added repo %s to GitHub installation %s via installation token",
                    repository_id,
                    installation_id,
                )
                return True
    except Exception as exc:
        logger.warning("Failed to add repo %s with inst token: %s", repository_id, exc)

    return False


def get_app_installations() -> List[Dict[str, Any]]:
    """Fetch all installations of the GitHub App using the App JWT."""
    try:
        app_jwt = create_app_jwt()
        url = f"{GITHUB_API_URL}/app/installations"
        log_debug(f"GET {url} with App JWT...")
        response = _GH_SESSION.get(
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

    target_gh_user = getattr(user, "github_username", None)
    if not target_gh_user:
        log_debug(f"User {getattr(user, 'email', 'unknown')} has no linked github_username, skipping sync.")
        return db.query(Repository).filter(Repository.user_id == user.id).all() if user else []

    log_debug(f"=== sync_github_app_repositories called for user={user.email}, github_username={target_gh_user} ===")
    installations_by_id: Dict[int, Dict[str, Any]] = {}

    # 1. Discover installations via GitHub App JWT that belong to target_gh_user
    user_inst = get_user_installation(target_gh_user)
    if user_inst and user_inst.get("id"):
        installations_by_id[user_inst["id"]] = user_inst

    app_insts = get_app_installations()
    for inst in app_insts:
        iid = inst.get("id")
        acct = inst.get("account", {}).get("login", "")
        if iid and acct.lower() == target_gh_user.lower():
            installations_by_id[iid] = inst

    # 2. Check existing GitHubInstallation records in DB for this user
    user_db_insts = db.query(GitHubInstallation).filter(
        (GitHubInstallation.user_id == user.id)
        | (func.lower(GitHubInstallation.account_name) == target_gh_user.lower())
    ).all()
    for db_inst in user_db_insts:
        if db_inst.github_installation_id and db_inst.github_installation_id not in installations_by_id:
            installations_by_id[db_inst.github_installation_id] = {
                "id": db_inst.github_installation_id,
                "account": {
                    "login": db_inst.account_name or target_gh_user,
                    "avatar_url": db_inst.account_avatar_url,
                },
            }

    # 3. Query user installations if github_access_token exists
    user_tok = getattr(user, "github_access_token", None)
    if user_tok:
        try:
            resp = _GH_SESSION.get(
                f"{GITHUB_API_URL}/user/installations",
                headers={
                    "Authorization": f"Bearer {user_tok}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Secura-Security-Scanner",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                for inst in resp.json().get("installations", []):
                    iid = inst.get("id")
                    if iid:
                        installations_by_id[iid] = inst
        except Exception as err:
            log_debug(f"Could not query /user/installations: {err}")

    synced_repos = []

    for inst_id, inst_data in installations_by_id.items():
        account = inst_data.get("account", {})
        account_name = account.get("login") or target_gh_user
        avatar_url = account.get("avatar_url", "")

        # Auto-link avatar if user doesn't have one
        try:
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
                db.commit()
        except Exception:
            db.rollback()

        # Create or update installation record strictly for this user
        inst_record = (
            db.query(GitHubInstallation)
            .filter(
                GitHubInstallation.github_installation_id == inst_id,
                GitHubInstallation.user_id == user.id,
            )
            .first()
        )
        try:
            if not inst_record:
                existing_inst = (
                    db.query(GitHubInstallation)
                    .filter(GitHubInstallation.github_installation_id == inst_id)
                    .first()
                )
                if existing_inst and (not existing_inst.user_id or (existing_inst.account_name and existing_inst.account_name.lower() == target_gh_user.lower())):
                    existing_inst.user_id = user.id
                    if account_name:
                        existing_inst.account_name = account_name
                    if avatar_url:
                        existing_inst.account_avatar_url = avatar_url
                    db.commit()
                    db.refresh(existing_inst)
                    inst_record = existing_inst
                else:
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
                .filter(
                    GitHubInstallation.github_installation_id == inst_id,
                    GitHubInstallation.user_id == user.id,
                )
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
                # Query existing repository for this user
                existing_repo = (
                    db.query(Repository)
                    .filter(
                        Repository.user_id == user.id,
                        (
                            (func.lower(Repository.full_name) == full_name.lower())
                            | (Repository.github_repo_id == repo_id if repo_id else False)
                        )
                    )
                    .first()
                )
                if existing_repo:
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
                    other_repo = (
                        db.query(Repository)
                        .filter(
                            (func.lower(Repository.full_name) == full_name.lower())
                            | (Repository.github_repo_id == repo_id if repo_id else False)
                        )
                        .first()
                    )
                    if other_repo and owner.lower() == target_gh_user.lower():
                        other_repo.user_id = user.id
                        other_repo.installation_id = inst_record.id
                        other_repo.is_monitored = True
                        db.commit()
                        db.refresh(other_repo)
                        synced_repos.append(other_repo)
                    elif not other_repo:
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
    plus any repositories accessible to the user on GitHub, annotated with whether they are
    already monitored in Secura. Strictly scoped to the authenticated user.
    """
    from app.models.repository import Repository
    from app.models.installation import GitHubInstallation

    existing_repos = db.query(Repository).filter(Repository.user_id == user.id).all()
    existing_full_names = {
        (r.full_name or "").lower(): r
        for r in existing_repos
        if r.full_name
    }

    repos_by_full_name: Dict[str, Dict[str, Any]] = {}
    target_username = getattr(user, "github_username", None)
    user_gh_auth = getattr(user, "github_access_token", None)

    # 1. Fetch from GitHub App Installations that belong ONLY to this user
    user_inst_ids = set()
    if target_username:
        u_inst = get_user_installation(target_username)
        if u_inst and u_inst.get("id"):
            user_inst_ids.add((u_inst["id"], u_inst.get("account", {}).get("login", target_username)))

        for inst in get_app_installations():
            iid = inst.get("id")
            acct = inst.get("account", {}).get("login", "")
            if iid and acct.lower() == target_username.lower():
                user_inst_ids.add((iid, acct))

    # Also check user's installations in DB
    db_insts = db.query(GitHubInstallation).filter(GitHubInstallation.user_id == user.id).all()
    for dbi in db_insts:
        if dbi.github_installation_id:
            user_inst_ids.add((dbi.github_installation_id, dbi.account_name or (target_username or "")))

    primary_installation_id = None
    for inst_id, account_name in user_inst_ids:
        if not primary_installation_id:
            primary_installation_id = inst_id
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
                "in_github_app": True,
            }

    # 2. Fetch all other repositories from GitHub so user can select ANY of their repos
    all_gh_repos = []
    if user_gh_auth:
        try:
            resp = _GH_SESSION.get(
                f"{GITHUB_API_URL}/user/repos",
                headers={
                    "Authorization": f"Bearer {user_gh_auth}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Secura-Security-Scanner",
                },
                params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"},
                timeout=12,
            )
            if resp.ok:
                all_gh_repos = resp.json()
        except Exception as exc:
            logger.debug("Failed to fetch user repos with token: %s", exc)

    if not all_gh_repos and target_username:
        try:
            resp = _GH_SESSION.get(
                f"{GITHUB_API_URL}/users/{target_username}/repos",
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Secura-Security-Scanner",
                },
                params={"per_page": 100, "sort": "updated"},
                timeout=12,
            )
            if resp.ok:
                all_gh_repos = resp.json()
        except Exception as exc:
            logger.debug("Failed to fetch public repos for user %s: %s", target_username, exc)

    for r in all_gh_repos:
        fn = r.get("full_name")
        if not fn:
            continue
        fn_key = fn.lower()
        if fn_key in repos_by_full_name:
            repos_by_full_name[fn_key]["in_github_app"] = True
            continue

        owner_login = r.get("owner", {}).get("login", target_username or "")
        repos_by_full_name[fn_key] = {
            "github_repo_id": r.get("id"),
            "name": r.get("name") or fn.split("/")[-1],
            "full_name": fn,
            "owner": owner_login,
            "default_branch": r.get("default_branch", "main"),
            "is_private": bool(r.get("private", False)),
            "html_url": r.get("html_url") or f"https://github.com/{fn}",
            "description": r.get("description") or "",
            "installation_id": primary_installation_id,
            "already_monitored": fn_key in existing_full_names,
            "in_github_app": False,
        }

    # Sort: Monitored first, then by in_github_app, then alphabetically
    result_list = list(repos_by_full_name.values())
    result_list.sort(key=lambda x: (not x["already_monitored"], not x.get("in_github_app", False), x["name"].lower()))
    return result_list

