import datetime
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
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
)

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

    return RepositoryResponse(
        id=repo.id,
        installation_id=repo.installation_id or "installation-manual",
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
    """List all monitored repositories for current user. Auto-syncs if empty."""
    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    if not repos:
        try:
            sync_github_app_repositories(db, current_user)
            repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
        except Exception as e:
            logger.warning("Auto-sync error on list_repositories: %s", e)

    if not repos:
        all_db_repos = db.query(Repository).all()
        if all_db_repos:
            for r in all_db_repos:
                r.user_id = current_user.id
            try:
                db.commit()
                repos = all_db_repos
            except Exception:
                db.rollback()

    return [enrich_repository_response(r, db) for r in repos]


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
        sync_github_app_repositories(db, current_user)
    except Exception as e:
        logger.error("Failed to sync GitHub App repositories: %s", e)

    repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    if not repos:
        all_db_repos = db.query(Repository).all()
        if all_db_repos:
            for r in all_db_repos:
                r.user_id = current_user.id
            try:
                db.commit()
                repos = all_db_repos
            except Exception:
                db.rollback()

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
    """Add multiple selected repositories to monitoring at once and trigger scans."""
    results = []
    for item in payload.repositories:
        clean_full_name = item.full_name.strip()
        if "/" not in clean_full_name:
            owner = current_user.github_username or "user"
            name = clean_full_name
            clean_full_name = f"{owner}/{name}"
        else:
            owner, name = clean_full_name.split("/", 1)

        existing = db.query(Repository).filter(Repository.full_name == clean_full_name).first()
        if existing:
            existing.is_monitored = True
            existing.user_id = current_user.id
            db.commit()
            db.refresh(existing)
            results.append(enrich_repository_response(existing, db))
            continue

        # Get or create installation
        installation = (
            db.query(GitHubInstallation)
            .filter(GitHubInstallation.user_id == current_user.id)
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

        repo_id_hash = abs(hash(clean_full_name)) % 1000000000
        repo = Repository(
            installation_id=installation.id,
            user_id=current_user.id,
            github_repo_id=item.github_repo_id or repo_id_hash,
            name=name,
            full_name=clean_full_name,
            owner=owner,
            default_branch=item.default_branch or "main",
            is_private=item.is_private,
            is_monitored=True,
            html_url=item.html_url or f"https://github.com/{clean_full_name}",
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        results.append(enrich_repository_response(repo, db))

    return results


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
def add_repository(
    payload: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new repository for pull request monitoring."""
    clean_full_name = payload.full_name.strip()
    if "/" not in clean_full_name:
        owner = current_user.github_username or "user"
        name = clean_full_name
        clean_full_name = f"{owner}/{name}"
    else:
        owner, name = clean_full_name.split("/", 1)

    existing = db.query(Repository).filter(Repository.full_name == clean_full_name).first()
    if existing:
        existing.is_monitored = True
        existing.user_id = current_user.id
        db.commit()
        db.refresh(existing)
        return enrich_repository_response(existing, db)

    # Ensure an installation exists for the user
    installation = (
        db.query(GitHubInstallation)
        .filter(GitHubInstallation.user_id == current_user.id)
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

    repo_id_hash = abs(hash(clean_full_name)) % 1000000000
    repo = Repository(
        installation_id=installation.id,
        user_id=current_user.id,
        github_repo_id=payload.github_repo_id or repo_id_hash,
        name=name,
        full_name=clean_full_name,
        owner=owner,
        default_branch=payload.default_branch or "main",
        is_private=payload.is_private,
        is_monitored=payload.is_monitored,
        html_url=payload.html_url or f"https://github.com/{clean_full_name}",
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

