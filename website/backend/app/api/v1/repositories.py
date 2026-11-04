import datetime
import logging
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.finding import Finding
from app.models.installation import GitHubInstallation
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.schemas.repository import (
    AvailableRepositoryResponse,
    BulkRepositoryAdd,
    RepositoryCreate,
    RepositoryResponse,
    RepositoryUpdate,
)
from app.schemas.scan import ScanResponse
from app.services.scan_runner import execute_repository_scan
from app.services.github_service import (
    get_user_available_github_repositories,
    sync_github_app_repositories,
    get_repository_installation_id,
    fetch_github_repository_details,
    add_repository_to_github_app_installation,
)

logger = logging.getLogger("secura.repositories")
router = APIRouter(prefix="/repositories", tags=["Repositories"])


def enrich_repository_response(repo: Repository, db: Session) -> RepositoryResponse:
    latest_scan = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id)
        .order_by(Scan.created_at.desc())
        .first()
    )

    open_findings = (
        db.query(Finding)
        .filter(Finding.repository_id == repo.id, Finding.status == "open")
        .all()
    )

    critical_count = sum(1 for f in open_findings if f.severity == "CRITICAL")
    high_count = sum(1 for f in open_findings if f.severity == "HIGH")

    fn = repo.full_name or repo.name or "repository"
    owner = repo.owner or (fn.split("/")[0] if "/" in fn else "owner")
    name = repo.name or (fn.split("/")[-1] if "/" in fn else fn)

    inst_id = None
    if repo.installation and repo.installation.github_installation_id:
        inst_id = repo.installation.github_installation_id
    else:
        inst = (
            db.query(GitHubInstallation)
            .filter(
                (GitHubInstallation.user_id == repo.user_id)
                | (func.lower(GitHubInstallation.account_name) == owner.lower())
            )
            .first()
        )
        if inst:
            inst_id = inst.github_installation_id

    app_url = (
        f"https://github.com/settings/installations/{inst_id}"
        if inst_id
        else "https://github.com/apps/secura-security-scanner"
    )

    return RepositoryResponse(
        id=repo.id,
        installation_id=repo.installation_id or "installation-manual",
        github_installation_id=inst_id,
        github_app_url=app_url,
        github_repo_id=repo.github_repo_id,
        name=name,
        full_name=fn,
        owner=owner,
        default_branch=repo.default_branch or "main",
        is_private=bool(repo.is_private),
        is_monitored=bool(repo.is_monitored),
        html_url=repo.html_url or f"https://github.com/{fn}",
        open_findings_count=len(open_findings),
        critical_findings_count=critical_count,
        high_findings_count=high_count,
        last_scan_status=latest_scan.scan_result if latest_scan else "passed",
        last_scan_at=latest_scan.created_at if latest_scan else None,
        created_at=repo.created_at or datetime.datetime.now(datetime.timezone.utc),
    )


@router.get("", response_model=List[RepositoryResponse])
def list_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all monitored repositories for current user. Fast DB lookup without blocking."""
    all_db_repos = db.query(Repository).all()
    for r in all_db_repos:
        if r.user_id != current_user.id:
            r.user_id = current_user.id
    if all_db_repos:
        try:
            db.commit()
        except Exception:
            db.rollback()

    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    if not repos:
        repos = all_db_repos

    # Only sync with GitHub if DB has 0 repositories
    if not repos:
        try:
            sync_github_app_repositories(db, current_user, force=False)
            repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
            if not repos:
                repos = db.query(Repository).all()
        except Exception as e:
            logger.warning("Initial auto-sync error on list_repositories: %s", e)

    return [enrich_repository_response(r, db) for r in repos]


@router.get("/debug-sync")
def debug_sync_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Diagnostic endpoint to inspect GitHub API responses and sync status."""
    synced = sync_github_app_repositories(db, current_user)

    debug_content = ""
    try:
        from pathlib import Path
        debug_file = Path("/home/jay/projects/Secura/sync_debug.log")
        if not debug_file.exists():
            from app.services.github_service import ROOT_DIR
            debug_file = ROOT_DIR / "sync_debug.log"
        if debug_file.exists():
            with open(debug_file, "r", encoding="utf-8") as f:
                debug_content = f.read()
    except Exception as e:
        debug_content = f"Error reading log: {e}"

    return {
        "user": {"id": current_user.id, "email": current_user.email, "github_username": current_user.github_username},
        "synced_count": len(synced),
        "synced_repos": [r.full_name for r in synced],
        "debug_log": debug_content[-4000:],
    }


@router.post("/sync", response_model=List[RepositoryResponse])
def sync_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sync repositories directly from GitHub App installations granted to Secura.
    Monitors them for pull request scanning.
    """
    try:
        sync_github_app_repositories(db, current_user, force=True)
    except Exception as e:
        logger.error("Failed to sync GitHub App repositories: %s", e)

    all_db_repos = db.query(Repository).all()
    for r in all_db_repos:
        if r.user_id != current_user.id:
            r.user_id = current_user.id
    if all_db_repos:
        try:
            db.commit()
        except Exception:
            db.rollback()

    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    if not repos:
        repos = all_db_repos

    return [enrich_repository_response(r, db) for r in repos]


@router.get("/available", response_model=List[AvailableRepositoryResponse])
def get_available_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch all GitHub repositories accessible to the user (via GitHub App installation
    or public repos) so the user can select and add them in the UI.
    """
    return get_user_available_github_repositories(current_user, db)


@router.post("/bulk-add", response_model=List[RepositoryResponse])
def bulk_add_repositories(
    payload: BulkRepositoryAdd,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add multiple selected repositories to monitoring at once and link with GitHub App."""
    results = []
    for item in payload.repositories:
        clean_full_name = item.full_name.strip()
        if "/" not in clean_full_name:
            owner = current_user.github_username or "user"
            name = clean_full_name
            clean_full_name = f"{owner}/{name}"
        else:
            owner, name = clean_full_name.split("/", 1)

        real_repo_id = item.github_repo_id
        default_branch = item.default_branch or "main"
        is_private = item.is_private
        html_url = item.html_url or f"https://github.com/{clean_full_name}"

        # Fetch real metadata from GitHub API if missing
        if not real_repo_id:
            gh_info = fetch_github_repository_details(owner, name)
            if gh_info:
                real_repo_id = gh_info.get("id") or real_repo_id
                default_branch = gh_info.get("default_branch") or default_branch
                is_private = bool(gh_info.get("private", is_private))
                html_url = gh_info.get("html_url") or html_url
                owner = gh_info.get("owner", {}).get("login", owner)
                name = gh_info.get("name", name)
                clean_full_name = gh_info.get("full_name", clean_full_name)

        # Discover or link GitHub App installation
        found_inst_id = get_repository_installation_id(owner, name) or item.installation_id
        installation = None
        if found_inst_id:
            installation = (
                db.query(GitHubInstallation)
                .filter(GitHubInstallation.github_installation_id == found_inst_id)
                .first()
            )
            if not installation:
                installation = GitHubInstallation(
                    user_id=current_user.id,
                    github_installation_id=found_inst_id,
                    account_name=owner,
                    account_avatar_url=current_user.avatar_url,
                )
                db.add(installation)
                db.commit()
                db.refresh(installation)

        if not installation:
            installation = (
                db.query(GitHubInstallation)
                .filter(
                    (GitHubInstallation.user_id == current_user.id)
                    | (func.lower(GitHubInstallation.account_name) == owner.lower())
                )
                .first()
            )

        if not installation:
            installation = GitHubInstallation(
                user_id=current_user.id,
                github_installation_id=abs(hash(current_user.id)) % 10000000,
                account_name=owner,
                account_avatar_url=current_user.avatar_url,
            )
            db.add(installation)
            db.commit()
            db.refresh(installation)

        # Attempt to apply to GitHub App installation on GitHub if user OAuth access token is available
        if installation and installation.github_installation_id and real_repo_id:
            user_tok = getattr(current_user, "github_access_token", None)
            if not user_tok:
                u_tok = db.query(User).filter(User.github_access_token.isnot(None)).first()
                if u_tok:
                    user_tok = u_tok.github_access_token
            if user_tok:
                add_repository_to_github_app_installation(
                    installation.github_installation_id,
                    real_repo_id,
                    user_tok,
                )

        existing = (
            db.query(Repository)
            .filter(
                (func.lower(Repository.full_name) == clean_full_name.lower())
                | (Repository.github_repo_id == real_repo_id if real_repo_id else False)
            )
            .first()
        )

        if existing:
            existing.is_monitored = True
            existing.user_id = current_user.id
            existing.installation_id = installation.id
            if real_repo_id:
                existing.github_repo_id = real_repo_id
            existing.name = name
            existing.full_name = clean_full_name
            existing.owner = owner
            existing.default_branch = default_branch
            existing.is_private = is_private
            existing.html_url = html_url
            db.commit()
            db.refresh(existing)
            results.append(enrich_repository_response(existing, db))
            continue

        repo_id_hash = abs(hash(clean_full_name)) % 1000000000
        repo = Repository(
            installation_id=installation.id,
            user_id=current_user.id,
            github_repo_id=real_repo_id or repo_id_hash,
            name=name,
            full_name=clean_full_name,
            owner=owner,
            default_branch=default_branch,
            is_private=is_private,
            is_monitored=True,
            html_url=html_url,
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        results.append(enrich_repository_response(repo, db))

    return results


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
def add_repository(
    payload: RepositoryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new repository for pull request monitoring and link with GitHub App."""
    clean_full_name = payload.full_name.strip()
    if "/" not in clean_full_name:
        owner = current_user.github_username or "user"
        name = clean_full_name
        clean_full_name = f"{owner}/{name}"
    else:
        owner, name = clean_full_name.split("/", 1)

    real_repo_id = payload.github_repo_id
    default_branch = payload.default_branch or "main"
    is_private = payload.is_private
    html_url = payload.html_url or f"https://github.com/{clean_full_name}"

    # Fetch real metadata from GitHub API if missing
    gh_info = fetch_github_repository_details(owner, name)
    if gh_info:
        real_repo_id = gh_info.get("id") or real_repo_id
        default_branch = gh_info.get("default_branch") or default_branch
        is_private = bool(gh_info.get("private", is_private))
        html_url = gh_info.get("html_url") or html_url
        owner = gh_info.get("owner", {}).get("login", owner)
        name = gh_info.get("name", name)
        clean_full_name = gh_info.get("full_name", clean_full_name)

    # Discover or link GitHub App installation for this repo
    found_inst_id = get_repository_installation_id(owner, name)
    installation = None
    if found_inst_id:
        installation = (
            db.query(GitHubInstallation)
            .filter(GitHubInstallation.github_installation_id == found_inst_id)
            .first()
        )
        if not installation:
            installation = GitHubInstallation(
                user_id=current_user.id,
                github_installation_id=found_inst_id,
                account_name=owner,
                account_avatar_url=current_user.avatar_url,
            )
            db.add(installation)
            db.commit()
            db.refresh(installation)

    if not installation:
        installation = (
            db.query(GitHubInstallation)
            .filter(
                (GitHubInstallation.user_id == current_user.id)
                | (func.lower(GitHubInstallation.account_name) == owner.lower())
            )
            .first()
        )

    if not installation:
        installation = GitHubInstallation(
            user_id=current_user.id,
            github_installation_id=abs(hash(current_user.id)) % 10000000,
            account_name=owner,
            account_avatar_url=current_user.avatar_url,
        )
        db.add(installation)
        db.commit()
        db.refresh(installation)

    # Attempt to apply to GitHub App installation on GitHub if user OAuth access token is available
    if installation and installation.github_installation_id and real_repo_id:
        user_tok = getattr(current_user, "github_access_token", None)
        if not user_tok:
            u_tok = db.query(User).filter(User.github_access_token.isnot(None)).first()
            if u_tok:
                user_tok = u_tok.github_access_token
        if user_tok:
            add_repository_to_github_app_installation(
                installation.github_installation_id,
                real_repo_id,
                user_tok,
            )

    existing = (
        db.query(Repository)
        .filter(
            (func.lower(Repository.full_name) == clean_full_name.lower())
            | (Repository.github_repo_id == real_repo_id if real_repo_id else False)
        )
        .first()
    )

    if existing:
        existing.is_monitored = True
        existing.user_id = current_user.id
        existing.installation_id = installation.id
        if real_repo_id:
            existing.github_repo_id = real_repo_id
        existing.name = name
        existing.full_name = clean_full_name
        existing.owner = owner
        existing.default_branch = default_branch
        existing.is_private = is_private
        existing.html_url = html_url
        db.commit()
        db.refresh(existing)
        return enrich_repository_response(existing, db)

    repo_id_hash = abs(hash(clean_full_name)) % 1000000000
    repo = Repository(
        installation_id=installation.id,
        user_id=current_user.id,
        github_repo_id=real_repo_id or repo_id_hash,
        name=name,
        full_name=clean_full_name,
        owner=owner,
        default_branch=default_branch,
        is_private=is_private,
        is_monitored=payload.is_monitored,
        html_url=html_url,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    return enrich_repository_response(repo, db)


@router.get("/{repository_id}", response_model=RepositoryResponse)
def get_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single repository details."""
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return enrich_repository_response(repo, db)


@router.patch("/{repository_id}", response_model=RepositoryResponse)
def update_repository(
    repository_id: str,
    payload: RepositoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update repository settings (monitoring status, default branch)."""
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if payload.is_monitored is not None:
        repo.is_monitored = payload.is_monitored
    if payload.default_branch is not None:
        repo.default_branch = payload.default_branch

    db.commit()
    db.refresh(repo)
    return enrich_repository_response(repo, db)


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a repository from monitoring."""
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    db.delete(repo)
    db.commit()


@router.post("/{repository_id}/scan", response_model=ScanResponse)
def trigger_manual_scan(
    repository_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger an asynchronous security scan on a repository."""
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    scan = Scan(
        repository_id=repo.id,
        commit_sha="manual",
        branch=repo.default_branch,
        scan_status="running",
        score=100,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    background_tasks.add_task(
        execute_repository_scan,
        repository_id=repo.id,
        commit_sha="manual",
        branch=repo.default_branch,
    )

    return ScanResponse(
        id=scan.id,
        repository_id=repo.id,
        repository_name=repo.full_name,
        commit_sha=scan.commit_sha,
        branch=scan.branch,
        scan_status=scan.scan_status,
        scan_result=scan.scan_result,
        score=scan.score,
        total_findings=0,
        critical_count=0,
        high_count=0,
        medium_count=0,
        low_count=0,
        created_at=scan.created_at,
    )

