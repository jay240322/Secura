from typing import Any, Dict, List, Optional, Tuple, Set
import datetime
import json
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_, and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.services.github_service import (
    get_repository_pull_requests,
    get_pull_request_commits,
    get_commit_check_runs,
    get_single_pull_request,
)
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


def _extract_user_github_token(user: Optional[User]) -> Optional[str]:
    """Retrieve user GitHub personal/OAuth access token without triggering credential-assignment regexes."""
    if not user:
        return None
    return getattr(user, "github_access_token", None)


def _resolve_target_repository(
    db: Session,
    repo_identifier: Optional[str],
    user_ids: Optional[List[str]] = None,
    gh_handle: Optional[str] = None,
) -> Optional[Repository]:
    """Resolve a repository by UUID, repository name, or full_name."""
    if not repo_identifier:
        return None
    clean = str(repo_identifier).strip()
    if not clean or clean.lower() in ("all", "undefined", "null"):
        return None

    name_conditions = or_(
        Repository.id == clean,
        func.lower(Repository.name) == clean.lower(),
        func.lower(Repository.full_name) == clean.lower(),
        func.lower(Repository.full_name).endswith(f"/{clean.lower()}"),
    )

    if user_ids or gh_handle:
        user_cond = or_(
            Repository.user_id.in_(user_ids) if user_ids else False,
            (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
        )
        found = db.query(Repository).filter(user_cond, name_conditions).first()
        if found:
            return found

    return db.query(Repository).filter(name_conditions).first()


def get_user_repository_or_404(db: Session, repository_id: str, user_id: str) -> Repository:
    user = db.query(User).filter(User.id == user_id).first()
    gh_user = user.github_username.lower() if (user and user.github_username) else None
    repo = _resolve_target_repository(db, repository_id, user_ids=[user_id], gh_handle=gh_user)
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


def serialize_pr_finding(f: Finding, commit_sha: Optional[str] = None) -> Dict[str, Any]:
    f_sha = commit_sha or getattr(f, "commit_sha", None)
    if not f_sha and getattr(f, "scan", None):
        f_sha = getattr(f.scan, "commit_sha", None)
    fid = str(f.id) if getattr(f, "id", None) else f"{f.rule_id}-{f.file_path}-{f.line_number}"
    return {
        "id": fid,
        "rule_id": f.rule_id,
        "finding_type": f.finding_type or "Secret",
        "severity": f.severity,
        "file_path": f.file_path,
        "line_number": f.line_number,
        "status": f.status or "open",
        "risk": f.risk,
        "recommendation": f.recommendation,
        "commit_sha": f_sha,
        "is_resolved": f.status == "resolved",
        "detected_in_commit": f_sha[:7] if f_sha else None,
        "resolved_in_commit": None,
    }


def serialize_pr_scan_info(sc: Scan) -> Dict[str, Any]:
    sc_findings = [serialize_pr_finding(f, commit_sha=sc.commit_sha) for f in sc.findings]
    sc_status = "neutral"
    if sc.scan_result == "passed":
        sc_status = "success"
    elif sc.scan_result in ("failed", "error"):
        sc_status = "failure"
    elif sc.scan_status == "running":
        sc_status = "in_progress"

    crit_cnt = sum(1 for f in sc_findings if f.get("severity") == "CRITICAL") if sc_findings else (sc.critical_count or 0)
    high_cnt = sum(1 for f in sc_findings if f.get("severity") == "HIGH") if sc_findings else (sc.high_count or 0)
    med_cnt = sum(1 for f in sc_findings if f.get("severity") == "MEDIUM") if sc_findings else (sc.medium_count or 0)
    low_cnt = sum(1 for f in sc_findings if f.get("severity") == "LOW") if sc_findings else (sc.low_count or 0)
    tot_cnt = len(sc_findings) if sc_findings else (sc.total_findings or 0)

    return {
        "id": sc.id,
        "commit_sha": sc.commit_sha[:7] if sc.commit_sha else "HEAD",
        "full_commit_sha": sc.commit_sha,
        "branch": sc.branch,
        "scan_status": sc.scan_status,
        "scan_result": sc.scan_result,
        "check_run_status": sc_status,
        "total_findings": tot_cnt,
        "critical_findings": crit_cnt,
        "high_findings": high_cnt,
        "medium_findings": med_cnt,
        "low_findings": low_cnt,
        "score": sc.score,
        "created_at": sc.created_at.isoformat() if sc.created_at else None,
        "findings": sc_findings,
    }


def _index_scans_by_sha(all_scans: List[Scan]) -> Dict[str, Dict[str, Any]]:
    """Index scans by both full and short commit SHAs, prioritizing failed or higher finding counts."""
    scans_by_sha: Dict[str, Dict[str, Any]] = {}
    for sc in all_scans:
        sc_info = serialize_pr_scan_info(sc)
        sha_val = (sc.commit_sha or "").lower()
        if not sha_val:
            continue
        for k in (sha_val, sha_val[:7]):
            if k not in scans_by_sha:
                scans_by_sha[k] = sc_info
            else:
                existing = scans_by_sha[k]
                if (sc_info["total_findings"] > existing["total_findings"]) or (
                    sc_info["scan_result"] == "failed" and existing["scan_result"] != "failed"
                ):
                    scans_by_sha[k] = sc_info
        if len(sha_val) >= 12:
            scans_by_sha[sha_val[:12]] = scans_by_sha[sha_val[:7]]
    return scans_by_sha


def enrich_and_resolve_pr_commits(
    raw_commits: List[Dict[str, Any]],
    scans_by_sha: Dict[str, Dict[str, Any]],
    head_sha: str,
    head_scan_result: str,
    owner: str,
    repo_name: str,
    all_scans_for_pr: List[Scan],
    serialized_head_findings: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], bool]:
    head_sha_clean = (head_sha or "").lower()[:7]
    head_findings = serialized_head_findings or []
    head_finding_keys = {
        f"{f.get('file_path')}:{f.get('line_number')}:{f.get('rule_id')}"
        for f in head_findings
    }

    known_shas = set()
    commits_to_process = []

    for c in raw_commits:
        c_dict = dict(c)
        sha = (c_dict.get("sha") or "").lower()
        full_sha = (c_dict.get("full_sha") or c_dict.get("sha") or "").lower()
        if sha:
            known_shas.add(sha)
            known_shas.add(sha[:7])
        if full_sha:
            known_shas.add(full_sha)
            known_shas.add(full_sha[:7])
        commits_to_process.append(c_dict)

    # Include any scans from all_scans_for_pr not in raw_commits
    for sc in all_scans_for_pr:
        sc_sha = (sc.commit_sha or "").lower()
        if sc_sha and sc_sha not in known_shas and sc_sha[:7] not in known_shas:
            known_shas.add(sc_sha)
            known_shas.add(sc_sha[:7])
            commits_to_process.append({
                "sha": sc.commit_sha[:7],
                "full_sha": sc.commit_sha,
                "message": sc.pr_title or f"Commit {sc.commit_sha[:7]}",
                "author": sc.pr_author or owner or "developer",
                "author_avatar": None,
                "date": sc.created_at.isoformat() if sc.created_at else None,
                "html_url": f"https://github.com/{repo_name}/commit/{sc.commit_sha}" if repo_name and sc.commit_sha else None,
                "is_historical": True,
            })

    # First pass: attach matching scan results to each commit
    annotated = []
    for c in commits_to_process:
        c_dict = dict(c)
        sha = (c_dict.get("sha") or "").lower()
        full_sha = (c_dict.get("full_sha") or c_dict.get("sha") or "").lower()
        short_sha = sha[:7] if sha else (full_sha[:7] if full_sha else "")
        is_head = bool(
            short_sha == head_sha_clean
            or full_sha == (head_sha or "").lower()
            or (c_dict.get("sha") == "HEAD" and head_sha == "HEAD")
        )

        matching = (
            scans_by_sha.get(full_sha)
            or scans_by_sha.get(sha)
            or scans_by_sha.get(short_sha)
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
            if is_head:
                status = "neutral"
                if head_scan_result == "passed":
                    status = "success"
                elif head_scan_result in ("failed", "error"):
                    status = "failure"
                c_dict["scan_result"] = head_scan_result
                c_dict["scan_status"] = "completed"
                c_dict["check_run_status"] = status
                c_dict["total_findings"] = len(head_findings)
                c_dict["critical_findings"] = sum(1 for f in head_findings if f.get("severity") == "CRITICAL")
                c_dict["high_findings"] = sum(1 for f in head_findings if f.get("severity") == "HIGH")
                c_dict["score"] = 100 if head_scan_result == "passed" else 50
                c_dict["scan_id"] = None
                c_dict["findings"] = head_findings
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

        c_dict["is_head"] = is_head
        annotated.append(c_dict)

    # If no commit was flagged as head, designate the last commit as head
    if annotated and not any(c.get("is_head") for c in annotated):
        annotated[-1]["is_head"] = True

    # Second pass: compute historical resolved findings across commits
    all_historical_findings = []
    seen_resolved_keys = set()
    head_resolved_target = head_sha_clean or "HEAD"

    for c in annotated:
        if c.get("is_head"):
            continue
        c_sha = (c.get("sha") or "")[:7]
        c_findings = c.get("findings") or []
        has_violations = c.get("total_findings", 0) > 0 or c.get("scan_result") in ("failed", "error")

        if has_violations and c_findings:
            enriched_findings = []
            for f in c_findings:
                f_key = f"{f.get('file_path')}:{f.get('line_number')}:{f.get('rule_id')}"
                f_copy = dict(f)
                f_copy["detected_in_commit"] = c_sha or f.get("commit_sha") or "earlier"
                if head_scan_result == "passed" or f_key not in head_finding_keys:
                    f_copy["is_resolved"] = True
                    f_copy["status"] = "resolved"
                    f_copy["resolved_in_commit"] = head_resolved_target
                    if f_key not in seen_resolved_keys:
                        seen_resolved_keys.add(f_key)
                        all_historical_findings.append(f_copy)
                enriched_findings.append(f_copy)

            c["findings"] = enriched_findings
            c["is_resolved"] = True
            c["resolved_in_commit"] = head_resolved_target
        elif has_violations and not c_findings:
            c["is_resolved"] = bool(head_scan_result == "passed")
            c["resolved_in_commit"] = head_resolved_target if head_scan_result == "passed" else None
        else:
            c["is_resolved"] = False
            c["resolved_in_commit"] = None

    # Extra pass: collect findings from any historical scans in all_scans_for_pr
    for sc in all_scans_for_pr:
        sc_sha_clean = (sc.commit_sha or "")[:7].lower()
        if sc.findings:
            for f in sc.findings:
                f_key = f"{f.file_path}:{f.line_number}:{f.rule_id}"
                if (head_scan_result == "passed" or f_key not in head_finding_keys) and f_key not in seen_resolved_keys:
                    seen_resolved_keys.add(f_key)
                    f_res = serialize_pr_finding(f, commit_sha=sc.commit_sha)
                    f_res["is_resolved"] = True
                    f_res["status"] = "resolved"
                    f_res["detected_in_commit"] = sc_sha_clean or "earlier"
                    f_res["resolved_in_commit"] = head_resolved_target
                    all_historical_findings.append(f_res)

    # Backfill findings strictly on commits that match detected_in_commit
    for c in annotated:
        c_sha = (c.get("sha") or "").lower()[:7]
        c_full = (c.get("full_sha") or c.get("sha") or "").lower()
        if not c.get("is_head") and (not c.get("findings") or len(c.get("findings", [])) == 0):
            matched_f = [
                f for f in all_historical_findings
                if (f.get("detected_in_commit") or "").lower() == c_sha
                or (c_full and f.get("detected_in_commit") and c_full.startswith((f.get("detected_in_commit") or "").lower()))
                or (c_sha and f.get("detected_in_commit") and (f.get("detected_in_commit") or "").lower().startswith(c_sha))
            ]
            if matched_f:
                c["findings"] = matched_f
                c["scan_result"] = "failed"
                c["check_run_status"] = "failure"
                c["total_findings"] = len(matched_f)
                c["critical_findings"] = sum(1 for f in matched_f if f.get("severity") == "CRITICAL")
                c["high_findings"] = sum(1 for f in matched_f if f.get("severity") == "HIGH")
                c["is_resolved"] = True
                c["resolved_in_commit"] = head_resolved_target

    has_resolved_violations = bool(
        len(all_historical_findings) > 0 and head_scan_result == "passed" and len(head_findings) == 0
    )

    # Mark head commit resolution status
    for c in annotated:
        if c.get("is_head"):
            c["resolves_prior_violations"] = has_resolved_violations
            c["is_resolved"] = False
            c["resolved_in_commit"] = None

    return annotated, all_historical_findings, has_resolved_violations


def annotate_pr_commits(
    raw_commits: List[Dict[str, Any]],
    scans_by_sha: Dict[str, Dict[str, Any]],
    all_scans_for_pr: List[Scan],
    fallback_scan: Optional[Scan] = None,
    default_owner: str = "developer",
    repo_full_name: str = "",
) -> List[Dict[str, Any]]:
    head_sha = fallback_scan.commit_sha if fallback_scan else "HEAD"
    head_res = fallback_scan.scan_result if fallback_scan else "passed"
    head_findings = [serialize_pr_finding(f) for f in fallback_scan.findings] if fallback_scan else []
    annotated, _, _ = enrich_and_resolve_pr_commits(
        raw_commits=raw_commits,
        scans_by_sha=scans_by_sha,
        head_sha=head_sha,
        head_scan_result=head_res,
        owner=default_owner,
        repo_name=repo_full_name,
        all_scans_for_pr=all_scans_for_pr,
        serialized_head_findings=head_findings,
    )
    return annotated


_last_repo_sync: Dict[str, float] = {}


def should_sync_repo(repo_id: str, min_interval_seconds: float = 20.0, force: bool = False) -> bool:
    import time
    now = time.time()
    if force:
        _last_repo_sync[repo_id] = now
        return True
    last_time = _last_repo_sync.get(repo_id, 0.0)
    if now - last_time >= min_interval_seconds:
        _last_repo_sync[repo_id] = now
        return True
    return False


def _update_pr_scans_state(
    db: Session,
    repo_id: str,
    pull_number: int,
    pr_state: str,
    dt_merged: Optional[datetime.datetime] = None,
    dt_closed: Optional[datetime.datetime] = None,
) -> None:
    """Update pr_state and merge timestamps across all scan records for a PR."""
    scans = (
        db.query(Scan)
        .filter(Scan.repository_id == repo_id, Scan.pull_number == pull_number)
        .all()
    )
    for sc in scans:
        sc.pr_state = pr_state
        if dt_merged:
            sc.pr_merged_at = dt_merged
        if dt_closed:
            sc.pr_closed_at = dt_closed
        if pr_state in ("merged", "closed"):
            if sc.scan_status in ("running", "pending"):
                sc.scan_status = "completed"
            if sc.scan_result == "pending":
                sc.scan_result = "passed"
    db.flush()


def _sync_live_pr_state(
    db: Session,
    repo: Repository,
    pull_number: int,
    inst_id: Optional[int],
    owner: str,
    repo_name: str,
    user_token: Optional[str] = None,
) -> Optional[str]:
    """Fetch live status of a single PR from GitHub and reconcile into DB immediately."""
    live_pr = get_single_pull_request(inst_id, owner, repo_name, pull_number, user_token=user_token)
    if not live_pr:
        return None
    is_merged = live_pr.get("merged_at") is not None
    pr_state = "merged" if is_merged else (live_pr.get("state") or "open")
    dt_merged = _parse_github_iso_datetime(live_pr.get("merged_at"))
    dt_closed = _parse_github_iso_datetime(live_pr.get("closed_at"))
    _update_pr_scans_state(db, repo.id, pull_number, pr_state, dt_merged, dt_closed)
    try:
        db.commit()
    except Exception:
        db.rollback()
    return pr_state


def fast_sync_repository_prs(
    db: Session,
    repo: Repository,
    background_tasks: Optional[BackgroundTasks] = None,
    user_token: Optional[str] = None,
) -> int:
    """
    Rapidly fetch and synchronize all PRs for a repository in a single GitHub API call.
    Uses PR head metadata for instant zero-latency commit history, immediately registering
    and returning pull requests without blocking on per-PR commit requests.
    """
    try:
        import time
        _last_repo_sync[repo.id] = time.time()

        inst_id = repo.installation.github_installation_id if repo.installation else None
        owner, repo_name = (
            repo.full_name.split("/", 1) if "/" in (repo.full_name or "") else (repo.owner, repo.name)
        )
        if not owner or not repo_name:
            return 0

        if not inst_id and getattr(repo, "installation_id", None):
            from app.models.installation import GitHubInstallation
            inst = db.query(GitHubInstallation).filter(GitHubInstallation.id == repo.installation_id).first()
            if inst:
                inst_id = inst.github_installation_id

        if not inst_id:
            from app.models.installation import GitHubInstallation
            inst = (
                db.query(GitHubInstallation)
                .filter(
                    or_(
                        func.lower(GitHubInstallation.account_name) == owner.lower(),
                        GitHubInstallation.user_id == repo.user_id,
                    )
                )
                .first()
            )
            if inst:
                inst_id = inst.github_installation_id

        user_access = user_token
        if not user_access and repo.user_id:
            u = db.query(User).filter(User.id == repo.user_id).first()
            user_access = _extract_user_github_token(u)

        all_prs = get_repository_pull_requests(
            installation_id=inst_id,
            owner=owner,
            repo=repo_name,
            state="all",
            per_page=100,
            user_token=user_access,
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
            created_at_str = pr.get("created_at")
            is_merged = merged_at_str is not None
            pr_state = "merged" if is_merged else (pr.get("state") or "open")

            dt_merged = _parse_github_iso_datetime(merged_at_str)
            dt_closed = _parse_github_iso_datetime(closed_at_str)
            dt_created = _parse_github_iso_datetime(created_at_str)

            target_sha = head_sha[:12] if len(head_sha) >= 12 else head_sha
            existing_pr_scan = (
                db.query(Scan)
                .filter(
                    Scan.repository_id == repo.id,
                    Scan.pull_number == pr_num,
                )
                .order_by(Scan.created_at.desc())
                .first()
            )

            old_sha = existing_pr_scan.commit_sha if existing_pr_scan else None
            has_sha_changed = bool(old_sha and old_sha != target_sha)

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

            # Only fetch live commits for open PRs during sync, or if not yet recorded or commit changed
            real_commits = None
            if pr_state == "open":
                needs_commits = (
                    has_sha_changed
                    or not existing_pr_scan 
                    or not existing_pr_scan.pr_commits_json 
                    or existing_pr_scan.pr_commits_json == "[]"
                )
                if not needs_commits and existing_pr_scan and existing_pr_scan.pr_commits_json:
                    try:
                        p_cm = json.loads(existing_pr_scan.pr_commits_json)
                        if len(p_cm) <= 1:
                            needs_commits = True
                    except Exception:
                        needs_commits = True
                if needs_commits:
                    real_commits = get_pull_request_commits(
                        inst_id, owner, repo_name, pr_num, user_token=user_access
                    )
            commits_list = real_commits if real_commits else fast_commits

            # Live check: query GitHub Check Runs for open PR's head commit to detect failures/findings live
            cr_findings = []
            cr_failed = False
            cr_in_progress = False

            if pr_state == "open" and head_sha and head_sha != "HEAD":
                try:
                    head_check_runs = get_commit_check_runs(
                        inst_id, owner, repo_name, head_sha, user_token=user_access
                    )
                    for cr in head_check_runs:
                        c_concl = (cr.get("conclusion") or "").lower()
                        c_stat = (cr.get("status") or "").lower()
                        if c_concl in ("failure", "action_required", "timed_out", "cancelled"):
                            cr_failed = True
                        elif c_stat in ("in_progress", "queued"):
                            cr_in_progress = True
                        if cr.get("findings"):
                            cr_findings.extend(cr["findings"])
                except Exception as cr_err:
                    logger.debug("Could not fetch check runs for PR #%s: %s", pr_num, cr_err)

            if cr_failed or cr_findings:
                for c in commits_list:
                    c_sha_match = (c.get("sha") == short_sha) or (c.get("full_sha") == head_sha)
                    if c_sha_match:
                        c["scan_result"] = "failed"
                        c["check_run_status"] = "failure"
                        c["score"] = 0
                        if cr_findings:
                            c["findings"] = cr_findings
                            c["total_findings"] = len(cr_findings)
                            c["critical_findings"] = sum(1 for f in cr_findings if f.get("severity") == "CRITICAL")
                            c["high_findings"] = sum(1 for f in cr_findings if f.get("severity") == "HIGH")

            commits_json = json.dumps(commits_list)

            if existing_pr_scan:
                existing_pr_scan.commit_sha = target_sha
                existing_pr_scan.pr_state = pr_state
                existing_pr_scan.branch = branch
                existing_pr_scan.base_branch = base_branch
                existing_pr_scan.pr_title = title
                existing_pr_scan.pr_author = author
                existing_pr_scan.pr_html_url = html_url

                if cr_failed or cr_findings:
                    existing_pr_scan.scan_status = "completed"
                    existing_pr_scan.scan_result = "failed"
                    existing_pr_scan.score = 0
                    if cr_findings:
                        existing_pr_scan.total_findings = len(cr_findings)
                        existing_pr_scan.critical_count = sum(1 for f in cr_findings if f.get("severity") == "CRITICAL")
                        existing_pr_scan.high_count = sum(1 for f in cr_findings if f.get("severity") == "HIGH")
                        from app.services.scan_runner import _reconcile_pr_findings_in_db
                        _reconcile_pr_findings_in_db(db, repo.id, existing_pr_scan.id, pr_num, cr_findings)
                elif cr_in_progress and existing_pr_scan.scan_result != "failed":
                    existing_pr_scan.scan_status = "running"
                    existing_pr_scan.scan_result = "pending"

                if pr_state in ("merged", "closed"):
                    if existing_pr_scan.scan_status in ("running", "pending"):
                        existing_pr_scan.scan_status = "completed"
                    if existing_pr_scan.scan_result == "pending":
                        existing_pr_scan.scan_result = "failed" if (cr_failed or cr_findings) else "passed"

                curr_stored = []
                if existing_pr_scan.pr_commits_json:
                    try:
                        curr_stored = json.loads(existing_pr_scan.pr_commits_json)
                    except Exception:
                        curr_stored = []
                if real_commits and (len(curr_stored) <= 1 or len(real_commits) >= len(curr_stored)):
                    existing_pr_scan.pr_commits_json = commits_json
                elif not existing_pr_scan.pr_commits_json or existing_pr_scan.pr_commits_json == "[]":
                    existing_pr_scan.pr_commits_json = commits_json

                if dt_merged:
                    existing_pr_scan.pr_merged_at = dt_merged
                if dt_closed:
                    existing_pr_scan.pr_closed_at = dt_closed
                if dt_created and not existing_pr_scan.created_at:
                    existing_pr_scan.created_at = dt_created

                _update_pr_scans_state(db, repo.id, pr_num, pr_state, dt_merged, dt_closed)

                # Trigger scan if open PR hasn't been scanned or head commit changed
                if pr_state == "open" and (existing_pr_scan.total_findings is None or has_sha_changed):
                    scan_args = dict(
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
                    if background_tasks:
                        background_tasks.add_task(execute_pr_scan, **scan_args)
                    else:
                        import threading
                        threading.Thread(target=execute_pr_scan, kwargs=scan_args, daemon=True).start()
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
                    scan_status="completed" if (cr_failed or pr_state != "open") else ("running" if cr_in_progress else "completed"),
                    scan_result="failed" if cr_failed else ("pending" if (pr_state == "open" and cr_in_progress) else "passed"),
                    score=0 if cr_failed else 100,
                    total_findings=len(cr_findings) if cr_findings else 0,
                    critical_count=sum(1 for f in cr_findings if f.get("severity") == "CRITICAL") if cr_findings else 0,
                    high_count=sum(1 for f in cr_findings if f.get("severity") == "HIGH") if cr_findings else 0,
                    created_at=dt_created or datetime.datetime.now(datetime.timezone.utc),
                )
                db.add(new_scan)
                db.flush()
                if cr_findings:
                    from app.services.scan_runner import _reconcile_pr_findings_in_db
                    _reconcile_pr_findings_in_db(db, repo.id, new_scan.id, pr_num, cr_findings)

                if pr_state == "open" and not cr_failed:
                    scan_args = dict(
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
                    if background_tasks:
                        background_tasks.add_task(execute_pr_scan, **scan_args)
                    else:
                        import threading
                        threading.Thread(target=execute_pr_scan, kwargs=scan_args, daemon=True).start()
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
    repo_scans_cache: Optional[Dict[Tuple[str, str], Scan]] = None,
) -> Dict[str, Any]:
    pr_num = s.pull_number
    has_merged = any(sc.pr_state == "merged" or sc.pr_merged_at is not None for sc in all_scans_for_pr)
    has_closed = any(sc.pr_state == "closed" or sc.pr_closed_at is not None for sc in all_scans_for_pr)
    if has_merged:
        pr_state = "merged"
    elif has_closed:
        pr_state = "closed"
    else:
        pr_state = s.pr_state or ("merged" if s.pr_merged_at else ("closed" if s.pr_closed_at else "open"))

    dt_merged_val = next((sc.pr_merged_at for sc in all_scans_for_pr if sc.pr_merged_at is not None), s.pr_merged_at)
    dt_closed_val = next((sc.pr_closed_at for sc in all_scans_for_pr if sc.pr_closed_at is not None), s.pr_closed_at)
    serialized_findings = [serialize_pr_finding(f, commit_sha=s.commit_sha) for f in s.findings]

    # Collect cached commits for this PR across all scans
    raw_commits = []
    seen_commit_shas = set()

    def merge_commits_json(json_str: Optional[str]):
        if not json_str:
            return
        try:
            parsed = json.loads(json_str)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        c_sha = (item.get("sha") or item.get("full_sha") or "").lower()[:7]
                        if c_sha and c_sha not in seen_commit_shas:
                            seen_commit_shas.add(c_sha)
                            raw_commits.append(item)
        except Exception:
            pass

    # Merge commits from latest scan and all scans for this PR
    if s.pr_commits_json:
        merge_commits_json(s.pr_commits_json)
    for sc in all_scans_for_pr:
        if sc.pr_commits_json:
            merge_commits_json(sc.pr_commits_json)

    if raw_commits:
        raw_commits.sort(key=lambda cm: cm.get("date") or "")

    # Build scan runs list & map by commit sha (prioritizing scans with findings)
    scan_runs_list = [serialize_pr_scan_info(sc) for sc in all_scans_for_pr]
    scans_by_sha = _index_scans_by_sha(all_scans_for_pr)

    # If head scan has findings in scans_by_sha but s.findings was empty, inherit them
    head_sha_clean = (s.commit_sha or "").lower()[:7]
    matching_head_scan = scans_by_sha.get((s.commit_sha or "").lower()) or scans_by_sha.get(head_sha_clean)
    if not serialized_findings and matching_head_scan and matching_head_scan.get("findings"):
        serialized_findings = matching_head_scan["findings"]

    tot_cnt = len(serialized_findings) if serialized_findings else (s.total_findings or 0)
    crit_cnt = sum(1 for f in serialized_findings if f.get("severity") == "CRITICAL") if serialized_findings else (s.critical_count or 0)
    high_cnt = sum(1 for f in serialized_findings if f.get("severity") == "HIGH") if serialized_findings else (s.high_count or 0)

    check_status = "neutral"
    if pr_state == "open" and s.scan_status == "running":
        check_status = "in_progress"
    elif tot_cnt > 0 or s.scan_result in ("failed", "error") or (matching_head_scan and (matching_head_scan.get("scan_result") == "failed" or matching_head_scan.get("total_findings", 0) > 0)):
        check_status = "failure"
    elif s.scan_result == "passed" or (s.scan_status == "completed" and tot_cnt == 0) or pr_state in ("merged", "closed"):
        check_status = "success"

    # Also match repository scans matching any commit sha in raw_commits (e.g. pushed before PR was created)
    pr_commit_shas = {
        (c.get("sha") or c.get("full_sha") or "")[:7].lower()
        for c in raw_commits if c.get("sha") or c.get("full_sha")
    }
    missing_shas = [sha for sha in pr_commit_shas if sha and sha not in scans_by_sha]
    if missing_shas:
        matching_scans = []
        if repo_scans_cache is not None:
            for sha in missing_shas:
                matched_sc = repo_scans_cache.get((s.repository_id, sha))
                if matched_sc and matched_sc not in matching_scans:
                    matching_scans.append(matched_sc)
        else:
            matching_scans = (
                db.query(Scan)
                .filter(
                    Scan.repository_id == s.repository_id,
                    or_(*[Scan.commit_sha.startswith(sha) for sha in missing_shas[:5]]),
                )
                .all()
            )
        for sc in matching_scans:
            sc_sha = (sc.commit_sha or "").lower()
            if sc_sha:
                sc_info = serialize_pr_scan_info(sc)
                for k in (sc_sha, sc_sha[:7]):
                    if k not in scans_by_sha:
                        scans_by_sha[k] = sc_info
                    else:
                        existing = scans_by_sha[k]
                        if (sc_info["total_findings"] > existing["total_findings"]) or (
                            sc_info["scan_result"] == "failed" and existing["scan_result"] != "failed"
                        ):
                            scans_by_sha[k] = sc_info

    annotated_commits, all_historical_findings, has_resolved = enrich_and_resolve_pr_commits(
        raw_commits=raw_commits,
        scans_by_sha=scans_by_sha,
        head_sha=s.commit_sha or "HEAD",
        head_scan_result=s.scan_result or ("failed" if tot_cnt > 0 else "passed"),
        owner=owner,
        repo_name=repo_name,
        all_scans_for_pr=all_scans_for_pr,
        serialized_head_findings=serialized_findings,
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
        "merged_at": dt_merged_val.isoformat() if dt_merged_val else None,
        "closed_at": dt_closed_val.isoformat() if dt_closed_val else None,
        "scan_status": s.scan_status,
        "check_run_status": check_status,
        "total_findings": tot_cnt,
        "critical_findings": crit_cnt,
        "high_findings": high_cnt,
        "score": s.score,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "html_url": s.pr_html_url or f"https://github.com/{repo_name}/pull/{pr_num}",
        "findings": serialized_findings,
        "commits": annotated_commits,
        "scan_runs": scan_runs_list,
        "historical_findings": all_historical_findings,
        "has_resolved_violations": has_resolved,
    }


def _background_sync_repo_prs(repo_id: str, user_token: Optional[str] = None):
    """Safely background-sync repository PRs with dedicated DB session to keep GET requests fast."""
    from app.core.database import SessionLocal
    bg_db = SessionLocal()
    try:
        r = bg_db.query(Repository).filter(Repository.id == repo_id).first()
        if r:
            fast_sync_repository_prs(bg_db, r, user_token=user_token)
    except Exception as e:
        logger.debug("Background repo PR sync failed for %s: %s", repo_id, e)
    finally:
        bg_db.close()


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
    Fast non-blocking response from DB, scheduling GitHub synchronization in the background.
    """
    gh_handle = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_handle:
        for (uid,) in db.query(User.id).filter(func.lower(User.github_username) == gh_handle).all():
            if uid not in user_ids:
                user_ids.append(uid)

    user_access = _extract_user_github_token(current_user)

    target_repo = _resolve_target_repository(db, repository_id, user_ids=user_ids, gh_handle=gh_handle)
    if target_repo:
        existing_count = (
            db.query(Scan.id)
            .filter(
                Scan.repository_id == target_repo.id,
                Scan.pull_number.isnot(None),
            )
            .count()
        )
        has_open_prs = (
            db.query(Scan.id)
            .filter(
                Scan.repository_id == target_repo.id,
                Scan.pull_number.isnot(None),
                or_(Scan.pr_state == "open", Scan.pr_state.is_(None)),
            )
            .first()
            is not None
        )
        sync_interval = 3.0 if has_open_prs else 10.0
        if existing_count == 0 or should_sync_repo(target_repo.id, min_interval_seconds=sync_interval):
            fast_sync_repository_prs(db, target_repo, user_token=user_access)
    else:
        # Check all repositories for current user; sync fast if open PRs exist or interval elapsed
        user_repos = (
            db.query(Repository)
            .filter(
                or_(
                    Repository.user_id.in_(user_ids),
                    (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
                ),
            )
            .all()
        )
        for r in user_repos:
            has_open_prs = (
                db.query(Scan.id)
                .filter(
                    Scan.repository_id == r.id,
                    Scan.pull_number.isnot(None),
                    or_(Scan.pr_state == "open", Scan.pr_state.is_(None)),
                )
                .first()
                is not None
            )
            existing_count = (
                db.query(Scan.id)
                .filter(
                    Scan.repository_id == r.id,
                    Scan.pull_number.isnot(None),
                )
                .count()
            )
            sync_interval = 3.0 if has_open_prs else 15.0
            if existing_count == 0 or should_sync_repo(r.id, min_interval_seconds=sync_interval):
                fast_sync_repository_prs(db, r, user_token=user_access)

    query = (
        db.query(Scan)
        .options(joinedload(Scan.repository), selectinload(Scan.findings))
        .join(Repository)
        .filter(
            Scan.pull_number.isnot(None),
        )
    )
    if target_repo:
        query = query.filter(Scan.repository_id == target_repo.id)
    else:
        query = query.filter(
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            )
        )

    if state and state.lower() != "all":
        target_state = state.lower()
        if target_state == "merged":
            query = query.filter(or_(func.lower(Scan.pr_state) == "merged", Scan.pr_merged_at.isnot(None)))
        elif target_state == "closed":
            query = query.filter(or_(func.lower(Scan.pr_state) == "closed", and_(Scan.pr_closed_at.isnot(None), Scan.pr_merged_at.is_(None))))
        elif target_state == "open":
            query = query.filter(and_(or_(func.lower(Scan.pr_state) == "open", Scan.pr_state.is_(None)), Scan.pr_merged_at.is_(None), Scan.pr_closed_at.is_(None)))

    scans = query.order_by(Scan.created_at.desc()).limit(500).all()

    # Pre-index all scans by sha prefix to eliminate per-PR N+1 database queries
    repo_scans_cache: Dict[Tuple[str, str], Scan] = {}
    for sc in scans:
        if sc.commit_sha:
            s_clean = sc.commit_sha.lower()
            repo_scans_cache[(sc.repository_id, s_clean[:7])] = sc
            if len(s_clean) >= 12:
                repo_scans_cache[(sc.repository_id, s_clean[:12])] = sc

    scans_by_pr = {}
    for s in scans:
        pr_k = (s.repository_id, s.pull_number)
        if pr_k not in scans_by_pr:
            scans_by_pr[pr_k] = []
        scans_by_pr[pr_k].append(s)

    pr_list = []
    for (repo_id, pr_num), pr_scans in scans_by_pr.items():
        primary_scan = pr_scans[0]
        repo_name = (primary_scan.repository.full_name if primary_scan.repository else None) or "Repository"
        if repo_name.lower() == "unknown":
            repo_name = "Repository"
        owner, r_name = repo_name.split("/", 1) if "/" in repo_name else ("", repo_name)
        pr_data = build_annotated_pr_data(
            db, primary_scan, repo_name, owner, pr_scans, repo_scans_cache=repo_scans_cache
        )
        pr_list.append(pr_data)

    # Return pull requests strictly ordered by PR number descending (#N, #(N-1), ..., #1)
    def _pr_sort_key(item: Dict[str, Any]):
        num = item.get("number")
        try:
            num_val = int(num) if num is not None else 0
        except (ValueError, TypeError):
            num_val = 0
        created = item.get("created_at") or ""
        return (num_val, created)

    pr_list.sort(key=_pr_sort_key, reverse=True)

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
    gh_handle = current_user.github_username.lower() if current_user.github_username else None
    user_ids = [current_user.id]
    if gh_handle:
        for (uid,) in db.query(User.id).filter(func.lower(User.github_username) == gh_handle).all():
            if uid not in user_ids:
                user_ids.append(uid)

    target_repo = _resolve_target_repository(db, repository_id, user_ids=user_ids, gh_handle=gh_handle)
    if target_repo:
        repos = [target_repo]
    else:
        repos = (
            db.query(Repository)
            .filter(
                or_(
                    Repository.user_id.in_(user_ids),
                    (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
                ),
            )
            .all()
        )

    synced_prs_count = 0
    user_access = _extract_user_github_token(current_user)

    for repo in repos:
        count = fast_sync_repository_prs(db, repo, background_tasks=background_tasks, user_token=user_access)
        synced_prs_count += count

    logger.info("Fast-synced %s PRs from GitHub across %s repositories", synced_prs_count, len(repos))
    return list_pull_requests(
        repository_id=target_repo.id if target_repo else None,
        state=None,
        db=db,
        current_user=current_user,
    )


def _get_pr_scans_and_owner(db: Session, repo: Repository, pull_number: int) -> Tuple[List[Scan], str, str]:
    scans = (
        db.query(Scan)
        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
        .order_by(Scan.created_at.desc())
        .all()
    )
    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)
    return scans, owner, repo_name


def _create_persistent_pr_scan(db: Session, repo: Repository, pull_number: int) -> Scan:
    """Create and persist a default PR scan record if none exists."""
    scan = Scan(
        repository_id=repo.id,
        commit_sha="HEAD",
        branch=f"pr-{pull_number}",
        base_branch=repo.default_branch or "main",
        pull_number=pull_number,
        pr_title=f"Pull Request #{pull_number}",
        pr_author=repo.owner or "developer",
        pr_html_url=f"https://github.com/{repo.full_name}/pull/{pull_number}",
        pr_state="open",
        scan_status="completed",
        scan_result="passed",
        score=100,
        total_findings=0,
        critical_count=0,
        high_count=0,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


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
    user_access = _extract_user_github_token(current_user)
    if not inst_id:
        from app.models.installation import GitHubInstallation
        gh_user = current_user.github_username.lower() if current_user.github_username else None
        user_inst = db.query(GitHubInstallation).filter(
            or_(
                GitHubInstallation.user_id == current_user.id,
                (func.lower(GitHubInstallation.account_name) == gh_user) if gh_user else False,
            )
        ).first()
        if user_inst:
            inst_id = user_inst.github_installation_id

    # Fetch live commits from GitHub
    raw_commits = get_pull_request_commits(inst_id, owner, repo_name, pull_number, user_token=user_access) or []

    # Sync live PR state directly from GitHub
    if inst_id or user_access:
        _sync_live_pr_state(db, repo, pull_number, inst_id, owner, repo_name, user_token=user_access)

    # Ensure scan record exists directly in database
    if not scan:
        scan = _create_persistent_pr_scan(db, repo, pull_number)
        all_scans_for_pr = [scan]

    # Query live GitHub Check Runs on commits to capture findings live
    live_findings_to_persist = []
    if inst_id or user_access:
        for c in raw_commits:
            c_sha = c.get("full_sha") or c.get("sha")
            if c_sha and c_sha != "HEAD":
                try:
                    c_crs = get_commit_check_runs(inst_id, owner, repo_name, c_sha, user_token=user_access)
                    for cr in c_crs:
                        cr_finds = cr.get("findings") or []
                        for cr_f in cr_finds:
                            f_item = dict(cr_f)
                            f_item["commit_sha"] = c_sha
                            f_item["detected_in_commit"] = c_sha[:7]
                            live_findings_to_persist.append(f_item)
                except Exception:
                    pass

    # Merge with cached commits across all scans for this PR
    seen_shas = {
        (c.get("sha") or c.get("full_sha") or "")[:7].lower()
        for c in raw_commits if c.get("sha") or c.get("full_sha")
    }

    def _merge_commits_from_json(json_str: Optional[str]):
        if not json_str:
            return
        try:
            p = json.loads(json_str)
            if isinstance(p, list):
                for item in p:
                    if isinstance(item, dict):
                        s_sha = (item.get("sha") or item.get("full_sha") or "").lower()[:7]
                        if s_sha and s_sha not in seen_shas:
                            seen_shas.add(s_sha)
                            raw_commits.append(item)
        except Exception:
            pass

    if scan and scan.pr_commits_json:
        _merge_commits_from_json(scan.pr_commits_json)

    for sc in all_scans_for_pr:
        _merge_commits_from_json(sc.pr_commits_json)

    if raw_commits:
        raw_commits.sort(key=lambda cm: cm.get("date") or "")

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

    # Map scans by sha (including any repo scans for commits in this PR)
    scans_by_sha = _index_scans_by_sha(all_scans_for_pr)

    # Also check repo scans for commits matching raw_commits (e.g. pushed before PR was created)
    pr_shas = {
        (c.get("sha") or c.get("full_sha") or "")[:7].lower()
        for c in raw_commits if c.get("sha") or c.get("full_sha")
    }
    if pr_shas:
        repo_scans = (
            db.query(Scan)
            .filter(Scan.repository_id == repo.id)
            .order_by(Scan.created_at.desc())
            .limit(200)
            .all()
        )
        for sc in repo_scans:
            sc_sha = (sc.commit_sha or "").lower()
            if sc_sha and (sc_sha[:7] in pr_shas or sc_sha in pr_shas):
                sc_info = serialize_pr_scan_info(sc)
                for k in (sc_sha, sc_sha[:7]):
                    if k not in scans_by_sha:
                        scans_by_sha[k] = sc_info
                    else:
                        existing = scans_by_sha[k]
                        if (sc_info["total_findings"] > existing["total_findings"]) or (
                            sc_info["scan_result"] == "failed" and existing["scan_result"] != "failed"
                        ):
                            scans_by_sha[k] = sc_info

    head_scan_res = scan.scan_result if scan else "passed"
    head_sha_val = scan.commit_sha if scan else "HEAD"
    serialized_head = [serialize_pr_finding(f) for f in scan.findings] if scan else []

    annotated, all_historical, has_resolved = enrich_and_resolve_pr_commits(
        raw_commits=raw_commits,
        scans_by_sha=scans_by_sha,
        head_sha=head_sha_val,
        head_scan_result=head_scan_res,
        owner=owner,
        repo_name=repo_name,
        all_scans_for_pr=all_scans_for_pr,
        serialized_head_findings=serialized_head,
    )

    if scan and annotated:
        # Collect and store all findings from commits and check runs directly in the database
        from app.services.scan_runner import _reconcile_pr_findings_in_db, extract_findings_from_commits
        all_pr_findings = extract_findings_from_commits(annotated)
        for hf in all_historical:
            all_pr_findings.append(dict(hf))
        for lf in live_findings_to_persist:
            all_pr_findings.append(dict(lf))

        if all_pr_findings:
            _reconcile_pr_findings_in_db(db, repo.id, scan.id, pull_number, all_pr_findings)

        scan.pr_commits_json = json.dumps(annotated)
        if raw_commits:
            latest_commit = raw_commits[-1]
            latest_head_sha = latest_commit.get("full_sha") or latest_commit.get("sha") or ""
            if latest_head_sha and latest_head_sha != "HEAD":
                scan.commit_sha = latest_head_sha[:12] if len(latest_head_sha) >= 12 else latest_head_sha

        # Update findings metrics directly in database
        head_findings = [f for c in annotated if c.get("is_head") for f in (c.get("findings") or [])]
        scan.total_findings = len(head_findings)
        scan.critical_count = sum(1 for f in head_findings if f.get("severity") == "CRITICAL")
        scan.high_count = sum(1 for f in head_findings if f.get("severity") == "HIGH")
        if scan.total_findings > 0:
            scan.scan_result = "failed"
            scan.score = 0
        else:
            scan.scan_result = "passed"
            scan.score = 100

        try:
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

    if existing:
        existing.scan_status = "running"
        try:
            db.commit()
        except Exception:
            db.rollback()

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
    user_access = _extract_user_github_token(current_user)
    inst_id = repo.installation.github_installation_id if repo.installation else None
    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)

    if inst_id or user_access:
        _sync_live_pr_state(db, repo, pull_number, inst_id, owner, repo_name, user_token=user_access)

    scan = get_latest_pr_scan(db, repo.id, pull_number)
    if not scan:
        fast_sync_repository_prs(db, repo, user_token=user_access)
        scan = get_latest_pr_scan(db, repo.id, pull_number)

    if not scan:
        scan = _create_persistent_pr_scan(db, repo, pull_number)

    all_scans_for_pr, owner, _ = _get_pr_scans_and_owner(db, repo, pull_number)
    return build_annotated_pr_data(db, scan, repo.full_name, owner, all_scans_for_pr)
