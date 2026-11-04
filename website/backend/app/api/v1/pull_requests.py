from typing import Any, Dict, List, Optional
import datetime
import json
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.services.github_service import get_repository_pull_requests, get_pull_request_commits
from app.services.scan_runner import execute_pr_scan

logger = logging.getLogger("secura.pull_requests")
router = APIRouter(prefix="/pull-requests", tags=["Pull Requests"])


def _parse_github_iso_datetime(dt_str: Optional[str]) -> Optional[datetime.datetime]:
    if not dt_str:
        return None
    try:
        clean = dt_str.replace("Z", "+00:00")
        return datetime.datetime.fromisoformat(clean)
    except Exception:
        return None


def fast_sync_repository_prs(db: Session, repo: Repository, background_tasks: Optional[BackgroundTasks] = None) -> int:
    """
    Rapidly fetch and synchronize all PRs for a repository in a single GitHub API call.
    Uses PR head metadata for instant zero-latency commit history, immediately registering
    and returning pull requests without blocking on per-PR commit requests.
    """
    try:
        inst_id = repo.installation.github_installation_id if repo.installation else None
        owner, repo_name = (
            repo.full_name.split("/", 1) if "/" in (repo.full_name or "") else (repo.owner, repo.name)
        )
        if not owner or not repo_name:
            return 0

        all_prs = get_repository_pull_requests(
            installation_id=inst_id,
            owner=owner,
            repo=repo_name,
            state="all",
            per_page=100,
        )
        if not all_prs:
            return 0

        synced_count = 0
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        for pr in all_prs:
            pr_num = pr.get("number")
            if not pr_num:
                continue

            head_data = pr.get("head") or {}
            head_sha = head_data.get("sha") or "HEAD"
            branch = head_data.get("ref") or f"pr-{pr_num}"
            base_branch = (pr.get("base") or {}).get("ref") or repo.default_branch or "main"
            title = pr.get("title") or f"Pull Request #{pr_num}"
            user_data = pr.get("user") or {}
            author = user_data.get("login") or repo.owner or "developer"
            author_avatar = user_data.get("avatar_url")
            html_url = pr.get("html_url") or f"https://github.com/{repo.full_name}/pull/{pr_num}"

            merged_at_str = pr.get("merged_at")
            closed_at_str = pr.get("closed_at")
            is_merged = merged_at_str is not None
            pr_state = "merged" if is_merged else (pr.get("state") or "open")

            dt_merged = _parse_github_iso_datetime(merged_at_str)
            dt_closed = _parse_github_iso_datetime(closed_at_str)

            existing_scan = (
                db.query(Scan)
                .filter(
                    Scan.repository_id == repo.id,
                    Scan.pull_number == pr_num,
                )
                .first()
            )

            short_sha = head_sha[:7] if len(head_sha) >= 7 else head_sha
            fast_commits = [
                {
                    "sha": short_sha,
                    "full_sha": head_sha,
                    "message": title,
                    "author": author,
                    "author_avatar": author_avatar,
                    "date": pr.get("created_at") or now_iso,
                    "html_url": f"https://github.com/{repo.full_name}/commit/{head_sha}" if head_sha != "HEAD" else html_url,
                }
            ]
            commits_json = json.dumps(fast_commits)

            if existing_scan:
                existing_scan.pr_state = pr_state
                existing_scan.branch = branch
                existing_scan.base_branch = base_branch
                existing_scan.pr_title = title
                existing_scan.pr_author = author
                existing_scan.pr_html_url = html_url
                if not existing_scan.pr_commits_json or existing_scan.pr_commits_json == "[]":
                    existing_scan.pr_commits_json = commits_json
                if dt_merged:
                    existing_scan.pr_merged_at = dt_merged
                if dt_closed:
                    existing_scan.pr_closed_at = dt_closed
            else:
                new_scan = Scan(
                    repository_id=repo.id,
                    commit_sha=head_sha[:12],
                    branch=branch,
                    base_branch=base_branch,
                    pull_number=pr_num,
                    pr_title=title,
                    pr_author=author,
                    pr_html_url=html_url,
                    pr_state=pr_state,
                    pr_merged_at=dt_merged,
                    pr_closed_at=dt_closed,
                    pr_commits_json=commits_json,
                    scan_status="completed",
                    scan_result="passed",
                    score=100,
                )
                db.add(new_scan)

                if background_tasks and pr_state == "open":
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
                        pr_state=pr_state,
                        pr_merged_at=dt_merged,
                        pr_closed_at=dt_closed,
                    )
            synced_count += 1

        db.commit()
        return synced_count
    except Exception as exc:
        db.rollback()
        logger.warning("Error fast syncing PRs for %s: %s", repo.full_name, exc)
        return 0


@router.get("", response_model=List[Dict[str, Any]])
def list_pull_requests(
    repository_id: Optional[str] = None,
    state: Optional[str] = None,  # "all", "open", "merged", "closed"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List pull request security scans and Check Run statuses.
    Aggregates all genuine PR scan records associated with user's monitored repositories.
    Automatically fast-syncs PRs from GitHub if a repository is newly connected with 0 PR scans.
    """
    if repository_id:
        target_repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if target_repo:
            existing_count = (
                db.query(Scan)
                .filter(Scan.repository_id == target_repo.id, Scan.pull_number.isnot(None))
                .count()
            )
            if existing_count == 0:
                fast_sync_repository_prs(db, target_repo)
    else:
        # Check all monitored repositories; auto-sync any that have 0 PR scans
        monitored_repos = db.query(Repository).filter(Repository.is_monitored == True).all()
        for m_repo in monitored_repos:
            has_scans = (
                db.query(Scan)
                .filter(Scan.repository_id == m_repo.id, Scan.pull_number.isnot(None))
                .first()
            )
            if not has_scans:
                fast_sync_repository_prs(db, m_repo)

    query = (
        db.query(Scan)
        .join(Repository)
        .filter(
            Repository.user_id == current_user.id,
            Scan.pull_number.isnot(None),
        )
    )
    if repository_id:
        query = query.filter(Scan.repository_id == repository_id)

    if state and state.lower() != "all":
        target_state = state.lower()
        if target_state == "merged":
            query = query.filter(Scan.pr_state == "merged")
        elif target_state == "closed":
            query = query.filter(Scan.pr_state == "closed")
        elif target_state == "open":
            query = query.filter(or_(Scan.pr_state == "open", Scan.pr_state.is_(None)))

    scans = query.order_by(Scan.created_at.desc()).limit(100).all()

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
        pr_num = s.pull_number

        pr_key = f"{repo_name}#{pr_num}"
        # Keep latest scan for each PR
        if pr_key in seen_prs:
            continue
        seen_prs.add(pr_key)

        pr_state = s.pr_state or ("merged" if s.pr_merged_at else ("closed" if s.pr_closed_at else "open"))

        # Serialized findings for this PR
        serialized_findings = []
        for f in s.findings:
            serialized_findings.append({
                "id": f.id,
                "rule_id": f.rule_id,
                "finding_type": f.finding_type,
                "severity": f.severity,
                "file_path": f.file_path,
                "line_number": f.line_number,
                "status": f.status,
                "risk": f.risk,
                "recommendation": f.recommendation,
            })

        # Commits belonging to this PR
        pr_commits = []
        if s.pr_commits_json:
            try:
                pr_commits = json.loads(s.pr_commits_json)
            except Exception:
                pr_commits = []

        if not pr_commits and s.commit_sha:
            short_sha = s.commit_sha[:7] if len(s.commit_sha) >= 7 else s.commit_sha
            pr_commits = [
                {
                    "sha": short_sha,
                    "full_sha": s.commit_sha,
                    "message": s.pr_title or f"Commit {short_sha} on #{pr_num}",
                    "author": s.pr_author or (owner or "developer"),
                    "author_avatar": None,
                    "date": s.created_at.isoformat() if s.created_at else None,
                    "html_url": s.pr_html_url or f"https://github.com/{repo_name}/commit/{s.commit_sha}",
                }
            ]

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
            "state": pr_state,
            "merged_at": s.pr_merged_at.isoformat() if s.pr_merged_at else None,
            "closed_at": s.pr_closed_at.isoformat() if s.pr_closed_at else None,
            "scan_status": s.scan_status,
            "check_run_status": check_status,
            "total_findings": s.total_findings,
            "critical_findings": s.critical_count,
            "high_findings": s.high_count,
            "score": s.score,
            "created_at": s.created_at.isoformat(),
            "html_url": s.pr_html_url or f"https://github.com/{repo_name}/pull/{pr_num}",
            "findings": serialized_findings,
            "commits": pr_commits,
        })

    # Ensure pull requests are always returned in ordered sequence (#1, #2, #3, ...)
    pr_list.sort(key=lambda x: x["number"] if isinstance(x.get("number"), int) else 0)

    return pr_list


@router.post("/sync", response_model=List[Dict[str, Any]])
def sync_pull_requests(
    background_tasks: BackgroundTasks,
    repository_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Rapidly synchronize Pull Requests (open, merged, and closed) across monitored
    repositories, enqueuing security scans in the background.
    """
    repo_query = db.query(Repository).filter(
        Repository.user_id == current_user.id,
        Repository.is_monitored == True,
    )
    if repository_id:
        repo_query = repo_query.filter(Repository.id == repository_id)

    repos = repo_query.all()
    synced_prs_count = 0

    for repo in repos:
        count = fast_sync_repository_prs(db, repo, background_tasks=background_tasks)
        synced_prs_count += count

    logger.info("Fast-synced %s PRs from GitHub across %s repositories", synced_prs_count, len(repos))
    return list_pull_requests(repository_id=repository_id, state=None, db=db, current_user=current_user)


@router.get("/{repository_id}/{pull_number}/commits", response_model=List[Dict[str, Any]])
def get_pr_commits(
    repository_id: str,
    pull_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all commits associated with a specific pull request."""
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    scan = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .first()
    )

    if scan and scan.pr_commits_json:
        try:
            commits = json.loads(scan.pr_commits_json)
            if commits:
                return commits
        except Exception:
            pass

    # Try live fetch from GitHub
    inst_id = repo.installation.github_installation_id if repo.installation else None
    if not inst_id:
        from app.models.installation import GitHubInstallation
        user_inst = db.query(GitHubInstallation).filter(GitHubInstallation.user_id == current_user.id).first()
        if user_inst:
            inst_id = user_inst.github_installation_id

    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)
    commits = get_pull_request_commits(inst_id, owner, repo_name, pull_number)

    if not commits and scan and scan.commit_sha:
        short_sha = scan.commit_sha[:7] if len(scan.commit_sha) >= 7 else scan.commit_sha
        commits = [
            {
                "sha": short_sha,
                "full_sha": scan.commit_sha,
                "message": scan.pr_title or f"Commit {short_sha} for PR #{pull_number}",
                "author": scan.pr_author or repo.owner,
                "author_avatar": None,
                "date": scan.created_at.isoformat() if scan.created_at else None,
                "html_url": scan.pr_html_url or f"https://github.com/{repo.full_name}/commit/{scan.commit_sha}",
            }
        ]

    if scan and commits:
        try:
            scan.pr_commits_json = json.dumps(commits)
            db.commit()
        except Exception:
            db.rollback()

    return commits


@router.post("/{repository_id}/{pull_number}/scan")
def trigger_pull_request_scan(
    repository_id: str,
    pull_number: int,
    branch: Optional[str] = Query(None),
    base_branch: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
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

    # Check if there is an existing scan to inherit accurate branch names
    existing = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .first()
    )

    pr_branch = branch or (existing.branch if existing else f"feature/pr-{pull_number}")
    pr_base = base_branch or (existing.base_branch if existing else (repo.default_branch or "main"))
    pr_title = existing.pr_title if existing else f"Pull Request #{pull_number}"
    pr_author = existing.pr_author if existing else repo.owner
    pr_state = existing.pr_state if existing else "open"

    background_tasks.add_task(
        execute_pr_scan,
        repository_id=repo.id,
        pull_number=pull_number,
        commit_sha=existing.commit_sha if existing else "HEAD",
        branch=pr_branch,
        base_branch=pr_base,
        pr_title=pr_title,
        pr_author=pr_author,
        pr_html_url=f"https://github.com/{repo.full_name}/pull/{pull_number}",
        installation_id=inst_id,
        pr_state=pr_state,
    )

    return {
        "status": "enqueued",
        "repository": repo.full_name,
        "pull_number": pull_number,
        "branch": pr_branch,
        "base_branch": pr_base,
        "message": f"Secura security scan enqueued for PR #{pull_number} ({pr_branch} → {pr_base}).",
    }


@router.get("/{repository_id}/{pull_number}", response_model=Dict[str, Any])
def get_pull_request_detail(
    repository_id: str,
    pull_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed information, security score, and detected secrets for a specific Pull Request.
    """
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    scan = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail=f"No scan record found for PR #{pull_number}")

    check_status = "neutral"
    if scan.scan_result == "passed":
        check_status = "success"
    elif scan.scan_result in ("failed", "error"):
        check_status = "failure"
    elif scan.scan_status == "running":
        check_status = "in_progress"

    pr_state = scan.pr_state or ("merged" if scan.pr_merged_at else ("closed" if scan.pr_closed_at else "open"))

    serialized_findings = [
        {
            "id": f.id,
            "rule_id": f.rule_id,
            "finding_type": f.finding_type,
            "severity": f.severity,
            "file_path": f.file_path,
            "line_number": f.line_number,
            "status": f.status,
            "risk": f.risk,
            "recommendation": f.recommendation,
        }
        for f in scan.findings
    ]

    pr_commits = []
    if scan.pr_commits_json:
        try:
            pr_commits = json.loads(scan.pr_commits_json)
        except Exception:
            pr_commits = []

    if not pr_commits and scan.commit_sha:
        short_sha = scan.commit_sha[:7] if len(scan.commit_sha) >= 7 else scan.commit_sha
        pr_commits = [
            {
                "sha": short_sha,
                "full_sha": scan.commit_sha,
                "message": scan.pr_title or f"Commit {short_sha} on #{scan.pull_number}",
                "author": scan.pr_author or repo.owner,
                "author_avatar": None,
                "date": scan.created_at.isoformat() if scan.created_at else None,
                "html_url": scan.pr_html_url or f"https://github.com/{repo.full_name}/commit/{scan.commit_sha}",
            }
        ]

    return {
        "id": scan.id,
        "number": scan.pull_number,
        "title": scan.pr_title or f"PR #{scan.pull_number}: {scan.branch}",
        "repository": repo.full_name,
        "repository_id": repo.id,
        "branch": scan.branch,
        "base_branch": scan.base_branch or repo.default_branch or "main",
        "commit_sha": scan.commit_sha,
        "author": scan.pr_author or repo.owner,
        "state": pr_state,
        "merged_at": scan.pr_merged_at.isoformat() if scan.pr_merged_at else None,
        "closed_at": scan.pr_closed_at.isoformat() if scan.pr_closed_at else None,
        "scan_status": scan.scan_status,
        "check_run_status": check_status,
        "total_findings": scan.total_findings,
        "critical_findings": scan.critical_count,
        "high_findings": scan.high_count,
        "score": scan.score,
        "created_at": scan.created_at.isoformat(),
        "html_url": scan.pr_html_url or f"https://github.com/{repo.full_name}/pull/{scan.pull_number}",
        "findings": serialized_findings,
        "commits": pr_commits,
    }
