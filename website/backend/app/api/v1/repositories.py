import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, or_
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
    med_count = sum(1 for f in open_findings if f.severity == "MEDIUM")
    low_count = sum(1 for f in open_findings if f.severity == "LOW")

    repo_score = max(0, 100 - (critical_count * 30 + high_count * 20 + med_count * 10 + low_count * 5))

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

    computed_status = (
        "failed" if (critical_count > 0 or high_count > 0)
        else (latest_scan.scan_result if latest_scan else ("failed" if len(open_findings) > 0 else "passed"))
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
        open_findings=len(open_findings),
        critical_findings=critical_count,
        high_findings=high_count,
        score=repo_score,
        last_scan_status=computed_status,
        last_scan_at=latest_scan.created_at if latest_scan else None,
        created_at=repo.created_at or datetime.datetime.now(datetime.timezone.utc),
    )


def enrich_repositories_batch(repos: List[Repository], db: Session) -> List[RepositoryResponse]:
    """Batch-enrich repositories in 2 ultra-fast aggregate queries instead of N+1 round-trips."""
    if not repos:
        return []

    repo_ids = [r.id for r in repos]
    user_ids = list(set([r.user_id for r in repos if r.user_id]))
    owners = list(set([r.owner.lower() for r in repos if r.owner]))

    # 1. Fetch latest scan per repository
    latest_scans_by_repo = {}
    is_pg = db.bind.dialect.name == "postgresql" if db.bind else True
    if is_pg:
        try:
            latest_scans = (
                db.query(Scan)
                .distinct(Scan.repository_id)
                .filter(Scan.repository_id.in_(repo_ids))
                .order_by(Scan.repository_id, Scan.created_at.desc())
                .all()
            )
            for sc in latest_scans:
                latest_scans_by_repo[sc.repository_id] = sc
        except Exception:
            scans = db.query(Scan).filter(Scan.repository_id.in_(repo_ids)).order_by(Scan.created_at.desc()).all()
            for sc in scans:
                if sc.repository_id not in latest_scans_by_repo:
                    latest_scans_by_repo[sc.repository_id] = sc
    else:
        scans = db.query(Scan).filter(Scan.repository_id.in_(repo_ids)).order_by(Scan.created_at.desc()).all()
        for sc in scans:
            if sc.repository_id not in latest_scans_by_repo:
                latest_scans_by_repo[sc.repository_id] = sc

    # 2. Fetch finding counts grouped by repository_id and severity in ONE query
    finding_counts = (
        db.query(
            Finding.repository_id,
            Finding.severity,
            func.count(Finding.id),
        )
        .filter(Finding.repository_id.in_(repo_ids), Finding.status == "open")
        .group_by(Finding.repository_id, Finding.severity)
        .all()
    )
    counts_by_repo = {}
    for rid, sev, cnt in finding_counts:
        if rid not in counts_by_repo:
            counts_by_repo[rid] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "total": 0}
        counts_by_repo[rid][sev] = cnt
        counts_by_repo[rid]["total"] += cnt

    # 3. Fetch installations in ONE query
    insts = (
        db.query(GitHubInstallation)
        .filter(
            or_(
                GitHubInstallation.user_id.in_(user_ids) if user_ids else False,
                func.lower(GitHubInstallation.account_name).in_(owners) if owners else False,
            )
        )
        .all()
    )
    inst_by_user = {i.user_id: i for i in insts if i.user_id}
    inst_by_owner = {i.account_name.lower(): i for i in insts if i.account_name}

    results = []
    for repo in repos:
        latest_scan = latest_scans_by_repo.get(repo.id)
        counts = counts_by_repo.get(repo.id, {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "total": 0})
        critical_count = counts["CRITICAL"]
        high_count = counts["HIGH"]
        med_count = counts["MEDIUM"]
        low_count = counts["LOW"]
        total_open = counts["total"]

        repo_score = max(0, 100 - (critical_count * 30 + high_count * 20 + med_count * 10 + low_count * 5))
        fn = repo.full_name or repo.name or "repository"
        owner = repo.owner or (fn.split("/")[0] if "/" in fn else "owner")
        name = repo.name or (fn.split("/")[-1] if "/" in fn else fn)

        inst_id = None
        if repo.installation and repo.installation.github_installation_id:
            inst_id = repo.installation.github_installation_id
        elif repo.user_id in inst_by_user:
            inst_id = inst_by_user[repo.user_id].github_installation_id
        elif owner.lower() in inst_by_owner:
            inst_id = inst_by_owner[owner.lower()].github_installation_id

        app_url = (
            f"https://github.com/settings/installations/{inst_id}"
            if inst_id
            else "https://github.com/apps/secura-security-scanner"
        )

        computed_status = (
            "failed" if (critical_count > 0 or high_count > 0)
            else (latest_scan.scan_result if latest_scan else ("failed" if total_open > 0 else "passed"))
        )

        results.append(
            RepositoryResponse(
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
                open_findings_count=total_open,
                critical_findings_count=critical_count,
                high_findings_count=high_count,
                open_findings=total_open,
                critical_findings=critical_count,
                high_findings=high_count,
                score=repo_score,
                last_scan_status=computed_status,
                last_scan_at=latest_scan.created_at if latest_scan else None,
                created_at=repo.created_at or datetime.datetime.now(datetime.timezone.utc),
            )
        )
    return results


def get_user_repositories_safe(db: Session, current_user: User) -> List[Repository]:
    """Retrieve all monitored repositories for current user strictly isolated by user_id or ownership."""
    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    return (
        db.query(Repository)
        .filter(
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            )
        )
        .all()
    )


def create_or_link_repository(
    db: Session,
    current_user: User,
    full_name: str,
    github_repo_id: Optional[int] = None,
    default_branch: Optional[str] = "main",
    is_private: bool = False,
    html_url: Optional[str] = None,
    is_monitored: bool = True,
    installation_id: Optional[int] = None,
) -> Repository:
    """Create or update a repository record and link it to GitHub App installation."""
    clean_full_name = full_name.strip()
    if "/" not in clean_full_name:
        owner = current_user.github_username or "user"
        name = clean_full_name
        clean_full_name = f"{owner}/{name}"
    else:
        owner, name = clean_full_name.split("/", 1)

    real_repo_id = github_repo_id
    branch = default_branch or "main"
    priv = is_private
    url = html_url or f"https://github.com/{clean_full_name}"

    if not real_repo_id:
        gh_info = fetch_github_repository_details(owner, name)
        if gh_info:
            real_repo_id = gh_info.get("id") or real_repo_id
            branch = gh_info.get("default_branch") or branch
            priv = bool(gh_info.get("private", priv))
            url = gh_info.get("html_url") or url
            owner = gh_info.get("owner", {}).get("login", owner)
            name = gh_info.get("name", name)
            clean_full_name = gh_info.get("full_name", clean_full_name)

    found_inst_id = get_repository_installation_id(owner, name) or installation_id
    installation = None
    if found_inst_id:
        installation = (
            db.query(GitHubInstallation)
            .filter(
                GitHubInstallation.github_installation_id == found_inst_id,
                GitHubInstallation.user_id == current_user.id,
            )
            .first()
        )
        if not installation:
            existing_inst = (
                db.query(GitHubInstallation)
                .filter(GitHubInstallation.github_installation_id == found_inst_id)
                .first()
            )
            if existing_inst and (existing_inst.user_id == current_user.id or (current_user.github_username and existing_inst.account_name.lower() == current_user.github_username.lower())):
                existing_inst.user_id = current_user.id
                installation = existing_inst
                db.commit()
            elif current_user.github_username and owner.lower() == current_user.github_username.lower():
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
        any_user_inst = (
            db.query(GitHubInstallation)
            .filter(GitHubInstallation.user_id == current_user.id)
            .first()
        )
        if any_user_inst:
            installation = any_user_inst
        elif current_user.github_username:
            u_inst = get_user_installation(current_user.github_username)
            if u_inst and u_inst.get("id"):
                installation = GitHubInstallation(
                    user_id=current_user.id,
                    github_installation_id=u_inst["id"],
                    account_name=current_user.github_username,
                    account_avatar_url=current_user.avatar_url,
                )
                db.add(installation)
                db.commit()
                db.refresh(installation)

    # Without installing the GitHub App on account, user cannot add repos
    if not installation or not installation.github_installation_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "The Secura GitHub App is not installed on your GitHub account. "
                "Please install the Secura GitHub App first to connect repositories."
            ),
        )

    # Automatically add the repository to the GitHub App installation on GitHub
    if installation and installation.github_installation_id and real_repo_id:
        user_tok = getattr(current_user, "github_access_token", None)
        add_repository_to_github_app_installation(
            installation.github_installation_id,
            real_repo_id,
            user_tok,
        )

    # First check if the repository is already registered to current_user
    existing = (
        db.query(Repository)
        .filter(
            Repository.user_id == current_user.id,
            (
                (func.lower(Repository.full_name) == clean_full_name.lower())
                | (Repository.github_repo_id == real_repo_id if real_repo_id else False)
            ),
        )
        .first()
    )

    if not existing:
        # Check if repo exists under another user to prevent UNIQUE constraint violation
        other_repo = (
            db.query(Repository)
            .filter(
                (func.lower(Repository.full_name) == clean_full_name.lower())
                | (Repository.github_repo_id == real_repo_id if real_repo_id else False)
            )
            .first()
        )
        if other_repo:
            # Only allow claim if current user is the verified owner of the GitHub repository
            if current_user.github_username and owner.lower() == current_user.github_username.lower():
                other_repo.user_id = current_user.id
                existing = other_repo
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Repository {clean_full_name} is already linked to another account.",
                )

    if existing:
        existing.is_monitored = is_monitored
        existing.user_id = current_user.id
        existing.installation_id = installation.id
        if real_repo_id:
            existing.github_repo_id = real_repo_id
        existing.name = name
        existing.full_name = clean_full_name
        existing.owner = owner
        existing.default_branch = branch
        existing.is_private = priv
        existing.html_url = url
        db.commit()
        db.refresh(existing)
        return existing

    repo_id_hash = abs(hash(clean_full_name)) % 1000000000
    repo = Repository(
        installation_id=installation.id,
        user_id=current_user.id,
        github_repo_id=real_repo_id or repo_id_hash,
        name=name,
        full_name=clean_full_name,
        owner=owner,
        default_branch=branch,
        is_private=priv,
        is_monitored=is_monitored,
        html_url=url,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return repo


@router.get("", response_model=List[RepositoryResponse])
def list_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all monitored repositories for current user. Fast DB lookup without blocking."""
    repos = get_user_repositories_safe(db, current_user)

    # Only sync with GitHub if DB has 0 repositories and user has a GitHub username linked
    if not repos and current_user.github_username:
        try:
            sync_github_app_repositories(db, current_user, force=False)
            repos = get_user_repositories_safe(db, current_user)
        except Exception as e:
            logger.warning("Initial auto-sync error on list_repositories: %s", e)

    return enrich_repositories_batch(repos, db)


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

    repos = get_user_repositories_safe(db, current_user)
    return enrich_repositories_batch(repos, db)


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
        inst_id_val = None
        if item.installation_id:
            try:
                inst_id_val = int(item.installation_id)
            except (ValueError, TypeError):
                inst_id_val = None
        repo = create_or_link_repository(
            db=db,
            current_user=current_user,
            full_name=item.full_name,
            github_repo_id=item.github_repo_id,
            default_branch=item.default_branch,
            is_private=item.is_private,
            html_url=item.html_url,
            is_monitored=True,
            installation_id=inst_id_val,
        )
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
    inst_id_val = None
    if payload.installation_id:
        try:
            inst_id_val = int(payload.installation_id)
        except (ValueError, TypeError):
            inst_id_val = None
    repo = create_or_link_repository(
        db=db,
        current_user=current_user,
        full_name=payload.full_name,
        github_repo_id=payload.github_repo_id,
        default_branch=payload.default_branch,
        is_private=payload.is_private,
        html_url=payload.html_url,
        is_monitored=payload.is_monitored,
        installation_id=inst_id_val,
    )
    return enrich_repository_response(repo, db)


@router.get("/{repository_id}/overview")
def get_repository_overview(
    repository_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Consolidated single-roundtrip endpoint returning repository details,
    all pull requests, and security findings in ONE fast request.
    Eliminates multi-request network overhead.
    """
    from app.api.v1.pull_requests import list_pull_requests
    from app.api.v1.findings import list_findings

    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    clean_id = repository_id.strip()
    repo = (
        db.query(Repository)
        .filter(
            or_(
                Repository.id == clean_id,
                func.lower(Repository.name) == clean_id.lower(),
                func.lower(Repository.full_name) == clean_id.lower(),
            ),
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            ),
        )
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    repo_resp = enrich_repository_response(repo, db)
    prs_resp = list_pull_requests(repository_id=repo.id, state=None, db=db, current_user=current_user)
    findings_resp = list_findings(repository_id=repo.id, scan_id=None, severity=None, status=None, search=None, skip=0, limit=100, db=db, current_user=current_user)

    return {
        "repository": repo_resp,
        "pull_requests": prs_resp,
        "findings": findings_resp,
    }


@router.get("/{repository_id}", response_model=RepositoryResponse)
def get_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single repository details by ID, slug, or repository name."""
    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    clean_id = repository_id.strip()
    repo = (
        db.query(Repository)
        .filter(
            or_(
                Repository.id == clean_id,
                func.lower(Repository.name) == clean_id.lower(),
                func.lower(Repository.full_name) == clean_id.lower(),
            ),
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            ),
        )
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
    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    clean_id = repository_id.strip()
    repo = (
        db.query(Repository)
        .filter(
            or_(
                Repository.id == clean_id,
                func.lower(Repository.name) == clean_id.lower(),
                func.lower(Repository.full_name) == clean_id.lower(),
            ),
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            ),
        )
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
    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    clean_id = repository_id.strip()
    repo = (
        db.query(Repository)
        .filter(
            or_(
                Repository.id == clean_id,
                func.lower(Repository.name) == clean_id.lower(),
                func.lower(Repository.full_name) == clean_id.lower(),
            ),
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            ),
        )
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
    gh_user = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_user:
        same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_user).all()
        user_ids = list(set([u[0] for u in same_users] + [current_user.id]))

    clean_id = repository_id.strip()
    repo = (
        db.query(Repository)
        .filter(
            or_(
                Repository.id == clean_id,
                func.lower(Repository.name) == clean_id.lower(),
                func.lower(Repository.full_name) == clean_id.lower(),
            ),
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_user) if gh_user else False,
            ),
        )
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

