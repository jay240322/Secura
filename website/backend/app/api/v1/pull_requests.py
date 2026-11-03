from typing import Any, Dict, List, Optional
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.services.github_service import get_open_pull_requests
from app.services.scan_runner import execute_pr_scan

logger = logging.getLogger("secura.pull_requests")
router = APIRouter(prefix="/pull-requests", tags=["Pull Requests"])


@router.get("", response_model=List[Dict[str, Any]])
def list_pull_requests(
    repository_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List pull request security scans and Check Run statuses.
    Aggregates all PR scan records associated with user's monitored repositories.
    """
    query = (
        db.query(Scan)
        .join(Repository)
        .filter(Repository.user_id == current_user.id)
    )
    if repository_id:
        query = query.filter(Scan.repository_id == repository_id)

    scans = query.order_by(Scan.created_at.desc()).limit(50).all()

    pr_list = []
    seen_prs = set()

    for s in scans:
        check_status = "neutral"
        if s.scan_result == "passed":
            check_status = "success"
        elif s.scan_result in ("failed", "error"):
            check_status = "failure"
        elif s.scan_status == "running":
            check_status = "in_progress"

        repo_name = s.repository.full_name if s.repository else "unknown"
        owner, r_name = repo_name.split("/", 1) if "/" in repo_name else ("", repo_name)
        pr_num = s.pull_number or 1

        pr_key = f"{repo_name}#{pr_num}"
        # Keep latest scan for each PR
        if pr_key in seen_prs:
            continue
        seen_prs.add(pr_key)

        pr_list.append({
            "id": s.id,
            "number": pr_num,
            "title": s.pr_title or f"PR #{pr_num}: {s.branch}",
            "repository": repo_name,
            "repository_id": s.repository_id,
            "branch": s.branch,
            "base_branch": s.base_branch or (s.repository.default_branch if s.repository else "main"),
            "commit_sha": s.commit_sha,
            "author": s.pr_author or (owner or "developer"),
            "scan_status": s.scan_status,
            "check_run_status": check_status,
            "total_findings": s.total_findings,
            "critical_findings": s.critical_count,
            "high_findings": s.high_count,
            "score": s.score,
            "created_at": s.created_at.isoformat(),
            "html_url": s.pr_html_url or f"https://github.com/{repo_name}/pull/{pr_num}",
        })

    return pr_list


@router.post("/sync", response_model=List[Dict[str, Any]])
def sync_pull_requests(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Query GitHub API for open Pull Requests across all monitored repositories
    and enqueue security scans for any new PRs.
    """
    repos = (
        db.query(Repository)
        .filter(Repository.user_id == current_user.id, Repository.is_monitored == True)
        .all()
    )

    enqueued_count = 0
    for repo in repos:
        inst_id = repo.installation.github_installation_id if repo.installation else None
        if not inst_id:
            continue

        owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)
        open_prs = get_open_pull_requests(inst_id, owner, repo_name)

        for pr in open_prs:
            pr_num = pr.get("number")
            head_sha = pr.get("head", {}).get("sha", "HEAD")
            branch = pr.get("head", {}).get("ref", "main")
            base_branch = pr.get("base", {}).get("ref", repo.default_branch)
            title = pr.get("title", f"Pull Request #{pr_num}")
            author = pr.get("user", {}).get("login", repo.owner)
            html_url = pr.get("html_url", f"https://github.com/{repo.full_name}/pull/{pr_num}")

            # Check if this exact commit on this PR was already scanned
            existing = (
                db.query(Scan)
                .filter(
                    Scan.repository_id == repo.id,
                    Scan.pull_number == pr_num,
                    Scan.commit_sha == head_sha[:12],
                )
                .first()
            )
            if not existing:
                background_tasks.add_task(
                    execute_pr_scan,
                    repository_id=repo.id,
                    pull_number=pr_num,
                    commit_sha=head_sha,
                    branch=branch,
                    base_branch=base_branch,
                    pr_title=title,
                    pr_author=author,
                    pr_html_url=html_url,
                    installation_id=inst_id,
                )
                enqueued_count += 1

    logger.info("Enqueued %s open PRs for background scan", enqueued_count)
    return list_pull_requests(db, current_user)


@router.post("/{repository_id}/{pull_number}/scan")
def trigger_pull_request_scan(
    repository_id: str,
    pull_number: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Manually trigger or test a security scan for a specific Pull Request.
    """
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    inst_id = repo.installation.github_installation_id if repo.installation else None

    background_tasks.add_task(
        execute_pr_scan,
        repository_id=repo.id,
        pull_number=pull_number,
        commit_sha="HEAD",
        branch=repo.default_branch,
        base_branch=repo.default_branch,
        pr_title=f"Pull Request #{pull_number}",
        pr_author=repo.owner,
        pr_html_url=f"https://github.com/{repo.full_name}/pull/{pull_number}",
        installation_id=inst_id,
    )

    return {
        "status": "enqueued",
        "repository": repo.full_name,
        "pull_number": pull_number,
        "message": f"Secura security scan enqueued for PR #{pull_number}.",
    }
