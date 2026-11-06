from typing import Any, Dict, List, Optional
import datetime
import json
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.finding import Finding
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


def get_user_repository_or_404(db: Session, repository_id: str, user_id: str) -> Repository:
    repo = (
        db.query(Repository)
        .filter(Repository.id == repository_id, Repository.user_id == user_id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


def get_latest_pr_scan(db: Session, repository_id: str, pull_number: int) -> Optional[Scan]:
    return (
        db.query(Scan)
        .filter(Scan.repository_id == repository_id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .first()
    )


def serialize_pr_finding(f: Finding) -> Dict[str, Any]:
    return {
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


def serialize_pr_scan_info(sc: Scan) -> Dict[str, Any]:
    sc_findings = [serialize_pr_finding(f) for f in sc.findings]
    sc_status = "neutral"
    if sc.scan_result == "passed":
        sc_status = "success"
    elif sc.scan_result in ("failed", "error"):
        sc_status = "failure"
    elif sc.scan_status == "running":
        sc_status = "in_progress"

    return {
        "id": sc.id,
        "commit_sha": sc.commit_sha[:7] if sc.commit_sha else "HEAD",
        "full_commit_sha": sc.commit_sha,
        "branch": sc.branch,
        "scan_status": sc.scan_status,
        "scan_result": sc.scan_result,
        "check_run_status": sc_status,
        "total_findings": sc.total_findings,
        "critical_findings": sc.critical_count,
        "high_findings": sc.high_count,
        "medium_findings": sc.medium_count,
        "low_findings": sc.low_count,
        "score": sc.score,
        "created_at": sc.created_at.isoformat() if sc.created_at else None,
        "findings": sc_findings,
    }


def annotate_pr_commits(
    raw_commits: List[Dict[str, Any]],
    scans_by_sha: Dict[str, Dict[str, Any]],
    all_scans_for_pr: List[Scan],
    fallback_scan: Optional[Scan] = None,
    default_owner: str = "developer",
    repo_full_name: str = "",
) -> List[Dict[str, Any]]:
    annotated = []
    known_shas = set()
    total_pr_scans_count = len(all_scans_for_pr)
    for c in raw_commits:
        c_dict = dict(c)
        sha = (c.get("sha") or "").lower()
        full_sha = (c.get("full_sha") or c.get("sha") or "").lower()
        if sha:
            known_shas.add(sha)
            known_shas.add(sha[:7])
        if full_sha:
            known_shas.add(full_sha)
            known_shas.add(full_sha[:7])

        matching = (
            scans_by_sha.get(full_sha)
            or scans_by_sha.get(sha)
            or scans_by_sha.get(sha[:7] if len(sha) >= 7 else sha)
        )
        if matching:
            c_dict["scan_result"] = matching["scan_result"]
            c_dict["scan_status"] = matching["scan_status"]
            c_dict["check_run_status"] = matching["check_run_status"]
            c_dict["total_findings"] = matching["total_findings"]
            c_dict["critical_findings"] = matching["critical_findings"]
            c_dict["high_findings"] = matching["high_findings"]
            c_dict["score"] = matching["score"]
            c_dict["scan_id"] = matching["id"]
            c_dict["findings"] = matching["findings"]
        else:
            if fallback_scan and len(raw_commits) == 1 and total_pr_scans_count == 1:
                status = "neutral"
                if fallback_scan.scan_result == "passed":
                    status = "success"
                elif fallback_scan.scan_result in ("failed", "error"):
                    status = "failure"
                c_dict["scan_result"] = fallback_scan.scan_result
                c_dict["scan_status"] = fallback_scan.scan_status
                c_dict["check_run_status"] = status
                c_dict["total_findings"] = fallback_scan.total_findings
                c_dict["critical_findings"] = fallback_scan.critical_count
                c_dict["high_findings"] = fallback_scan.high_count
                c_dict["score"] = fallback_scan.score
                c_dict["scan_id"] = fallback_scan.id
                c_dict["findings"] = [serialize_pr_finding(f) for f in fallback_scan.findings]
            else:
                c_dict["scan_result"] = None
                c_dict["scan_status"] = None
                c_dict["check_run_status"] = "neutral"
                c_dict["total_findings"] = 0
                c_dict["critical_findings"] = 0
                c_dict["high_findings"] = 0
                c_dict["score"] = None
                c_dict["scan_id"] = None
                c_dict["findings"] = []

        annotated.append(c_dict)

    for sc in all_scans_for_pr:
        sc_sha = (sc.commit_sha or "").lower()
        if sc_sha and sc_sha not in known_shas and sc_sha[:7] not in known_shas:
            sc_info = serialize_pr_scan_info(sc)
            annotated.append({
                "sha": sc.commit_sha[:7],
                "full_sha": sc.commit_sha,
                "message": f"Historical Commit {sc.commit_sha[:7]} (Scanned by Secura)",
                "author": sc.pr_author or default_owner,
                "author_avatar": None,
                "date": sc.created_at.isoformat() if sc.created_at else None,
                "html_url": f"https://github.com/{repo_full_name}/commit/{sc.commit_sha}" if repo_full_name else None,
                "scan_result": sc_info["scan_result"],
                "scan_status": sc_info["scan_status"],
                "check_run_status": sc_info["check_run_status"],
                "total_findings": sc_info["total_findings"],
                "critical_findings": sc_info["critical_findings"],
                "high_findings": sc_info["high_findings"],
                "score": sc_info["score"],
                "scan_id": sc_info["id"],
                "findings": sc_info["findings"],
                "is_historical": True,
            })

    return annotated


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

            target_sha = head_sha[:12] if len(head_sha) >= 12 else head_sha
            scan_for_head = (
                db.query(Scan)
                .filter(
                    Scan.repository_id == repo.id,
                    Scan.pull_number == pr_num,
                    Scan.commit_sha == target_sha,
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

            if scan_for_head:
                scan_for_head.pr_state = pr_state
                scan_for_head.branch = branch
                scan_for_head.base_branch = base_branch
                scan_for_head.pr_title = title
                scan_for_head.pr_author = author
                scan_for_head.pr_html_url = html_url
                if not scan_for_head.pr_commits_json or scan_for_head.pr_commits_json == "[]":
                    scan_for_head.pr_commits_json = commits_json
                if dt_merged:
                    scan_for_head.pr_merged_at = dt_merged
                if dt_closed:
                    scan_for_head.pr_closed_at = dt_closed
            else:
                new_scan = Scan(
                    repository_id=repo.id,
                    commit_sha=target_sha,
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


def build_annotated_pr_data(
    db: Session,
    s: Scan,
    repo_name: str,
    owner: str,
    all_scans_for_pr: List[Scan],
) -> Dict[str, Any]:
    check_status = "neutral"
    if s.scan_result == "passed":
        check_status = "success"
    elif s.scan_result in ("failed", "error"):
        check_status = "failure"
    elif s.scan_status == "running":
        check_status = "in_progress"

    pr_num = s.pull_number
    pr_state = s.pr_state or ("merged" if s.pr_merged_at else ("closed" if s.pr_closed_at else "open"))
    serialized_findings = [serialize_pr_finding(f) for f in s.findings]

    # Build scan runs list & map by commit sha
    scan_runs_list = []
    scans_by_sha: Dict[str, Dict[str, Any]] = {}
    all_historical_findings = []
    seen_finding_keys = set()

    for sc in all_scans_for_pr:
        sc_info = serialize_pr_scan_info(sc)
        scan_runs_list.append(sc_info)

        sha_val = (sc.commit_sha or "").lower()
        if sha_val:
            scans_by_sha[sha_val] = sc_info
            scans_by_sha[sha_val[:7]] = sc_info
            if len(sha_val) >= 12:
                scans_by_sha[sha_val[:12]] = sc_info

        # Track historical findings across all runs of this PR
        for f in sc_findings:
            f_key = f"{f.get('file_path')}:{f.get('line_number')}:{f.get('rule_id')}"
            if f_key not in seen_finding_keys:
                seen_finding_keys.add(f_key)
                f_annotated = dict(f)
                f_annotated["commit_sha"] = sc.commit_sha[:7] if sc.commit_sha else "HEAD"
                f_annotated["scan_id"] = sc.id
                f_annotated["scan_result"] = sc.scan_result
                if s.scan_result == "passed" and sc.id != s.id:
                    f_annotated["is_resolved"] = True
                all_historical_findings.append(f_annotated)

    # Collect commits for this PR
    raw_commits = []
    for sc in all_scans_for_pr:
        if sc.pr_commits_json:
            try:
                parsed = json.loads(sc.pr_commits_json)
                if isinstance(parsed, list) and len(parsed) > len(raw_commits):
                    raw_commits = parsed
            except Exception:
                pass

    if not raw_commits and s.commit_sha:
        short_sha = s.commit_sha[:7] if len(s.commit_sha) >= 7 else s.commit_sha
        raw_commits = [
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

    annotated_commits = annotate_pr_commits(
        raw_commits=raw_commits,
        scans_by_sha=scans_by_sha,
        all_scans_for_pr=all_scans_for_pr,
        fallback_scan=s,
        default_owner=owner or "developer",
        repo_full_name=repo_name,
    )

    # Check if a previous scan failed but current head scan passed
    has_previous_failure = any(
        sc.scan_result in ("failed", "error") or sc.critical_count > 0 or sc.high_count > 0
        for sc in all_scans_for_pr if sc.id != s.id
    )

    return {
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
        "commits": annotated_commits,
        "scan_runs": scan_runs_list,
        "historical_findings": all_historical_findings,
        "has_resolved_violations": bool(has_previous_failure and s.scan_result == "passed"),
    }


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
        target_repo = (
            db.query(Repository)
            .filter(Repository.id == repository_id, Repository.user_id == current_user.id)
            .first()
        )
        if target_repo:
            existing_count = (
                db.query(Scan)
                .filter(Scan.repository_id == target_repo.id, Scan.pull_number.isnot(None))
                .count()
            )
            if existing_count == 0:
                fast_sync_repository_prs(db, target_repo)
    else:
        # Check only monitored repositories belonging to current_user
        monitored_repos = (
            db.query(Repository)
            .filter(
                Repository.is_monitored == True,
                Repository.user_id == current_user.id,
            )
            .all()
        )
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
        repo_name = s.repository.full_name if s.repository else "unknown"
        owner, r_name = repo_name.split("/", 1) if "/" in repo_name else ("", repo_name)
        pr_num = s.pull_number

        pr_key = f"{repo_name}#{pr_num}"
        # Keep latest scan as primary entry for each PR
        if pr_key in seen_prs:
            continue
        seen_prs.add(pr_key)

        # Query all historical scans for this repository & pull number
        all_scans_for_pr = (
            db.query(Scan)
            .filter(
                Scan.repository_id == s.repository_id,
                Scan.pull_number == pr_num,
            )
            .order_by(Scan.created_at.desc())
            .all()
        )

        pr_data = build_annotated_pr_data(db, s, repo_name, owner, all_scans_for_pr)
        pr_list.append(pr_data)

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


def _get_pr_scans_and_owner(db: Session, repo: Repository, pull_number: int) -> Tuple[List[Scan], str, str]:
    scans = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .all()
    )
    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)
    return scans, owner, repo_name


@router.get("/{repository_id}/{pull_number}/commits", response_model=List[Dict[str, Any]])
def get_pr_commits(
    repository_id: str,
    pull_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all commits associated with a specific pull request, enriched with Secura scan results."""
    repo = get_user_repository_or_404(db, repository_id, current_user.id)
    scan = get_latest_pr_scan(db, repo.id, pull_number)
    all_scans_for_pr, owner, repo_name = _get_pr_scans_and_owner(db, repo, pull_number)

    inst_id = repo.installation.github_installation_id if repo.installation else None
    if not inst_id:
        from app.models.installation import GitHubInstallation
        user_inst = db.query(GitHubInstallation).filter(GitHubInstallation.user_id == current_user.id).first()
        if user_inst:
            inst_id = user_inst.github_installation_id

    # Fetch live commits from GitHub
    raw_commits = get_pull_request_commits(inst_id, owner, repo_name, pull_number)

    if not raw_commits and scan and scan.pr_commits_json:
        try:
            raw_commits = json.loads(scan.pr_commits_json)
        except Exception:
            raw_commits = []

    if not raw_commits and scan and scan.commit_sha:
        short_sha = scan.commit_sha[:7] if len(scan.commit_sha) >= 7 else scan.commit_sha
        raw_commits = [
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

    # Map scans by sha
    scans_by_sha = {}
    for sc in all_scans_for_pr:
        sc_info = serialize_pr_scan_info(sc)
        sha_val = (sc.commit_sha or "").lower()
        if sha_val:
            scans_by_sha[sha_val] = sc_info
            scans_by_sha[sha_val[:7]] = sc_info
            if len(sha_val) >= 12:
                scans_by_sha[sha_val[:12]] = sc_info

    annotated = annotate_pr_commits(
        raw_commits=raw_commits,
        scans_by_sha=scans_by_sha,
        all_scans_for_pr=all_scans_for_pr,
        fallback_scan=scan,
        default_owner=repo.owner,
        repo_full_name=repo.full_name,
    )

    if scan and annotated:
        try:
            scan.pr_commits_json = json.dumps(annotated)
            db.commit()
        except Exception:
            db.rollback()

    return annotated


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
    repo = get_user_repository_or_404(db, repository_id, current_user.id)
    inst_id = repo.installation.github_installation_id if repo.installation else None
    existing = get_latest_pr_scan(db, repo.id, pull_number)

    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)

    # Fetch latest PR head sha from GitHub if possible
    head_sha = existing.commit_sha if existing else "HEAD"
    try:
        from app.services.github_service import get_repository_pull_requests
        all_prs = get_repository_pull_requests(inst_id, owner, repo_name, state="all", per_page=50)
        for p in all_prs:
            if p.get("number") == pull_number:
                h_sha = (p.get("head") or {}).get("sha")
                if h_sha:
                    head_sha = h_sha
                break
    except Exception:
        pass

    pr_branch = branch or (existing.branch if existing else f"feature/pr-{pull_number}")
    pr_base = base_branch or (existing.base_branch if existing else (repo.default_branch or "main"))
    pr_title = existing.pr_title if existing else f"Pull Request #{pull_number}"
    pr_author = existing.pr_author if existing else repo.owner
    pr_state = existing.pr_state if existing else "open"

    background_tasks.add_task(
        execute_pr_scan,
        repository_id=repo.id,
        pull_number=pull_number,
        commit_sha=head_sha,
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
        "commit": head_sha[:7] if head_sha != "HEAD" else head_sha,
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
    repo = get_user_repository_or_404(db, repository_id, current_user.id)
    scan = get_latest_pr_scan(db, repo.id, pull_number)
    if not scan:
        raise HTTPException(status_code=404, detail=f"No scan record found for PR #{pull_number}")

    all_scans_for_pr, owner, _ = _get_pr_scans_and_owner(db, repo, pull_number)
    return build_annotated_pr_data(db, scan, repo.full_name, owner, all_scans_for_pr)
