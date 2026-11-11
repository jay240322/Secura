import json
from typing import Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, defer, joinedload, selectinload

from app.api.deps import get_current_user, get_user_scope_ids
from app.core.database import get_db
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.schemas.finding import FindingResponse, FindingUpdate
from app.services.scanner_service import get_remediation_catalog

router = APIRouter(prefix="/findings", tags=["Findings"])


def batch_reconcile_findings(
    findings: List[Finding], db: Session
) -> List[Tuple[Finding, Optional[str], Optional[str]]]:
    """
    Rapidly reconciles all findings in a single batched pass with 0 N+1 queries.
    Checks if a finding was detected in a commit that was later resolved by a subsequent commit
    on the same PR or branch.
    """
    if not findings:
        return []

    repo_ids = list(set(f.repository_id for f in findings if f.repository_id))
    if not repo_ids:
        return [
            (
                f,
                (f.scan.commit_sha or "")[:7] if f.scan and f.scan.commit_sha else None,
                None,
            )
            for f in findings
        ]

    # Preload recent scans and their findings in a single batched query (skip heavy pr_commits_json)
    recent_scans = (
        db.query(Scan)
        .options(defer(Scan.pr_commits_json), selectinload(Scan.findings))
        .filter(Scan.repository_id.in_(repo_ids))
        .order_by(Scan.created_at.desc())
        .limit(120)
        .all()
    )

    latest_by_pr: Dict[Tuple[str, int], Scan] = {}
    latest_by_branch: Dict[Tuple[str, str], Scan] = {}

    for sc in recent_scans:
        if sc.pull_number is not None:
            pr_k = (sc.repository_id, sc.pull_number)
            if pr_k not in latest_by_pr:
                latest_by_pr[pr_k] = sc
        elif sc.branch:
            br_k = (sc.repository_id, sc.branch)
            if br_k not in latest_by_branch:
                latest_by_branch[br_k] = sc

    results = []
    for f in findings:
        scan = f.scan
        detected_in = (scan.commit_sha or "")[:7] if scan and scan.commit_sha else None
        resolved_in = None

        if not scan:
            results.append((f, detected_in, resolved_in))
            continue

        latest_scan = None
        if scan.pull_number is not None:
            latest_scan = latest_by_pr.get((f.repository_id, scan.pull_number))
        elif scan.branch:
            latest_scan = latest_by_branch.get((f.repository_id, scan.branch))

        if latest_scan:
            if latest_scan.scan_result == "passed":
                resolved_in = (latest_scan.commit_sha or "")[:7] or "HEAD"
                if f.status != "ignored":
                    f.status = "resolved"
            elif latest_scan.id != scan.id:
                has_in_latest = any(
                    lf.file_path == f.file_path and lf.rule_id == f.rule_id
                    for lf in (latest_scan.findings or [])
                )
                if not has_in_latest and f.status != "ignored":
                    resolved_in = (latest_scan.commit_sha or "")[:7] or "HEAD"
                    f.status = "resolved"
        if f.status == "resolved" and not resolved_in:
            resolved_in = (
                (latest_scan.commit_sha or "")[:7]
                if latest_scan and latest_scan.commit_sha
                else (detected_in or "latest")
            )

        results.append((f, detected_in, resolved_in))

    return results


def reconcile_finding(finding: Finding, db: Session) -> Tuple[Finding, Optional[str], Optional[str]]:
    """Legacy helper for single finding reconciliation."""
    res = batch_reconcile_findings([finding], db)
    return res[0] if res else (finding, None, None)


def to_finding_response(
    finding: Finding,
    repo_name: Optional[str] = None,
    detected_in_commit: Optional[str] = None,
    resolved_in_commit: Optional[str] = None,
    pull_number: Optional[int] = None,
) -> FindingResponse:
    scan = finding.scan
    commit_sha = (scan.commit_sha or "")[:7] if scan and scan.commit_sha else None
    detected = detected_in_commit or commit_sha
    is_res = (finding.status == "resolved")
    resolved = resolved_in_commit if is_res else None

    # Calculate human-readable repository name (prefer name, fallback to full_name)
    resolved_repo_name = repo_name
    if not resolved_repo_name and finding.repository:
        resolved_repo_name = finding.repository.name or finding.repository.full_name
    if not resolved_repo_name or resolved_repo_name.lower() in ("unknown", "repository"):
        resolved_repo_name = (finding.repository.name if finding.repository else None) or "Repository"

    clean_type = (finding.finding_type or "").strip()
    clean_rule = (finding.rule_id or "").strip()
    clean_path = (finding.file_path or "").strip()
    clean_status = (finding.status or "").strip().lower()

    if not clean_type or clean_type.lower() == "unknown":
        if clean_rule and clean_rule.lower() != "unknown":
            clean_type = clean_rule.replace("_", " ").title()
        else:
            clean_type = "Hardcoded Secret"

    if not clean_rule or clean_rule.lower() == "unknown":
        clean_rule = clean_type.upper().replace(" ", "_").replace("-", "_")

    if not clean_path or clean_path.lower() == "unknown" or clean_path == "`unknown`":
        clean_path = "source_file"

    if not clean_status or clean_status == "unknown":
        clean_status = "open"

    resolved_pull_number = scan.pull_number if (scan and scan.pull_number is not None) else None

    return FindingResponse(
        id=finding.id,
        scan_id=finding.scan_id,
        repository_id=finding.repository_id,
        repository_name=resolved_repo_name,
        rule_id=clean_rule,
        finding_type=clean_type,
        severity=finding.severity or "MEDIUM",
        file_path=clean_path,
        line_number=finding.line_number or 1,
        status=clean_status,
        ignore_reason=finding.ignore_reason,
        risk=finding.risk or f"Potential {clean_type} exposure detected in source code.",
        recommendation=finding.recommendation or "Remove credential from source code and revoke compromised secrets.",
        commit_sha=commit_sha,
        detected_in_commit=detected,
        resolved_in_commit=resolved,
        is_resolved=is_res,
        pull_number=resolved_pull_number,
        branch=scan.branch if scan else None,
        first_detected=finding.first_detected,
        last_detected=finding.last_detected,
        created_at=finding.created_at,
    )


@router.get("", response_model=List[FindingResponse])
def list_findings(
    repository_id: Optional[str] = None,
    repo_name: Optional[str] = None,
    pull_number: Optional[int] = None,
    scan_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List findings with rich filtering, search, commit tracking, and status reconciliation."""
    user_ids, gh_handle = get_user_scope_ids(db, current_user)

    query = (
        db.query(Finding)
        .options(
            joinedload(Finding.repository),
            joinedload(Finding.scan).defer(Scan.pr_commits_json),
        )
        .join(Repository)
        .filter(
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            )
        )
    )

    if repository_id:
        query = query.filter(Finding.repository_id == repository_id)
    if repo_name and repo_name.lower().strip() not in ("repository", "all", ""):
        clean_rn = repo_name.lower().strip()
        short_rn = clean_rn.split("/")[-1] if "/" in clean_rn else clean_rn
        query = query.filter(
            or_(
                func.lower(Repository.name) == clean_rn,
                func.lower(Repository.name) == short_rn,
                func.lower(Repository.full_name) == clean_rn,
                func.lower(Repository.full_name).endswith(f"/{short_rn}"),
            )
        )
    if pull_number is not None:
        pr_scans_q = (
            db.query(Scan)
            .join(Repository, Scan.repository_id == Repository.id)
            .filter(
                Scan.pull_number == pull_number,
                or_(
                    Repository.user_id.in_(user_ids),
                    (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
                ),
            )
        )
        if repository_id:
            pr_scans_q = pr_scans_q.filter(Scan.repository_id == repository_id)
        elif repo_name and repo_name.lower().strip() not in ("repository", "all", ""):
            clean_rn = repo_name.lower().strip()
            short_rn = clean_rn.split("/")[-1] if "/" in clean_rn else clean_rn
            pr_scans_q = pr_scans_q.filter(
                or_(
                    func.lower(Repository.name) == clean_rn,
                    func.lower(Repository.name) == short_rn,
                    func.lower(Repository.full_name) == clean_rn,
                    func.lower(Repository.full_name).endswith(f"/{short_rn}"),
                )
            )
        pr_scans = pr_scans_q.all()
        pr_scan_ids = [s.id for s in pr_scans]

        # Only auto-ingest from pr_commits_json if scan recorded findings that aren't in Finding table yet
        if pr_scan_ids:
            existing_f_count = (
                db.query(func.count(Finding.id))
                .filter(Finding.scan_id.in_(pr_scan_ids))
                .scalar()
                or 0
            )
            if existing_f_count == 0 and any((s.total_findings or 0) > 0 for s in pr_scans):
                for s in pr_scans:
                    if s.pr_commits_json:
                        try:
                            c_list = json.loads(s.pr_commits_json)
                            if isinstance(c_list, list):
                                from app.services.scan_runner import _reconcile_pr_findings_in_db, extract_findings_from_commits
                                c_finds = extract_findings_from_commits(c_list)
                                if c_finds:
                                    _reconcile_pr_findings_in_db(db, s.repository_id, s.id, pull_number, c_finds)
                                    db.commit()
                        except Exception:
                            pass

        if pr_scan_ids:
            query = query.filter(Finding.scan_id.in_(pr_scan_ids))
        else:
            query = query.filter(False)
    if scan_id:
        query = query.filter(Finding.scan_id == scan_id)
    if severity:
        query = query.filter(Finding.severity == severity.upper())
    if status:
        st_lower = status.lower()
        if st_lower in ("resolved", "solved"):
            query = query.filter(Finding.status == "resolved")
        elif st_lower == "open":
            query = query.filter(Finding.status == "open")
        elif st_lower == "ignored":
            query = query.filter(Finding.status == "ignored")
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Finding.finding_type.ilike(pattern))
            | (Finding.file_path.ilike(pattern))
            | (Finding.rule_id.ilike(pattern))
        )

    findings = query.order_by(Finding.created_at.desc()).offset(skip).limit(limit).all()

    # Reconcile resolution with subsequent commits using ultra-fast batch pass
    reconciled_tuples = batch_reconcile_findings(findings, db)
    status_changed = False

    # Auto-heal any historical findings in DB with Unknown / empty values
    for f in findings:
        updated = False
        f_type = (f.finding_type or "").strip()
        f_rule = (f.rule_id or "").strip()
        f_path = (f.file_path or "").strip()
        f_stat = (f.status or "").strip().lower()

        if not f_type or f_type.lower() == "unknown":
            if f_rule and f_rule.lower() != "unknown":
                f.finding_type = f_rule.replace("_", " ").title()
            else:
                f.finding_type = "Hardcoded Secret"
            updated = True

        if not f_rule or f_rule.lower() == "unknown":
            f.rule_id = (f.finding_type or "Hardcoded Secret").upper().replace(" ", "_").replace("-", "_")
            updated = True

        if not f_path or f_path.lower() == "unknown" or f_path == "`unknown`":
            f.file_path = "source_file"
            updated = True

        if not f_stat or f_stat == "unknown":
            f.status = "open"
            updated = True

        if updated:
            status_changed = True

    responses = []
    for reconciled_f, detected_sha, resolved_sha in reconciled_tuples:
        responses.append(
            to_finding_response(
                reconciled_f,
                detected_in_commit=detected_sha,
                resolved_in_commit=resolved_sha,
                pull_number=pull_number,
            )
        )

    if status_changed:
        try:
            db.commit()
        except Exception:
            db.rollback()

    return responses


@router.get("/{finding_id}", response_model=FindingResponse)
def get_finding(
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full detail for a finding, including redacted preview and remediation guidance."""
    user_ids, gh_handle = get_user_scope_ids(db, current_user)

    finding = (
        db.query(Finding)
        .options(
            joinedload(Finding.repository),
            joinedload(Finding.scan).defer(Scan.pr_commits_json),
        )
        .join(Repository)
        .filter(
            Finding.id == finding_id,
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            ),
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Auto-heal finding fields
    heal_needed = False
    if not finding.finding_type or finding.finding_type.lower() == "unknown":
        if finding.rule_id and finding.rule_id.lower() != "unknown":
            finding.finding_type = finding.rule_id.replace("_", " ").title()
        else:
            finding.finding_type = "Hardcoded Secret"
        heal_needed = True
    if not finding.rule_id or finding.rule_id.lower() == "unknown":
        finding.rule_id = (finding.finding_type or "Hardcoded Secret").upper().replace(" ", "_").replace("-", "_")
        heal_needed = True
    if not finding.file_path or finding.file_path.lower() == "unknown" or finding.file_path == "`unknown`":
        finding.file_path = "source_file"
        heal_needed = True
    if not finding.status or finding.status.lower() == "unknown":
        finding.status = "open"
        heal_needed = True

    if heal_needed:
        try:
            db.commit()
        except Exception:
            db.rollback()

    reconciled_f, detected_sha, resolved_sha = reconcile_finding(finding, db)
    return to_finding_response(
        reconciled_f,
        detected_in_commit=detected_sha,
        resolved_in_commit=resolved_sha,
    )


@router.patch("/{finding_id}", response_model=FindingResponse)
def update_finding(
    finding_id: str,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a finding as resolved, open, or ignored with reason."""
    gh_handle = current_user.github_username.lower() if current_user.github_username else None
    finding = (
        db.query(Finding)
        .join(Repository)
        .filter(
            Finding.id == finding_id,
            or_(
                Repository.user_id == current_user.id,
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            ),
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    valid_statuses = {"open", "resolved", "ignored"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    finding.status = payload.status
    if payload.status == "ignored":
        finding.ignore_reason = payload.ignore_reason or "Manually ignored by user"
    elif payload.status == "resolved":
        finding.ignore_reason = None

    db.commit()
    db.refresh(finding)
    reconciled_f, detected_sha, resolved_sha = reconcile_finding(finding, db)
    return to_finding_response(
        reconciled_f,
        detected_in_commit=detected_sha,
        resolved_in_commit=resolved_sha,
    )


@router.get("/catalog/remediation")
def get_catalog():
    """Retrieve the complete structured rule-based remediation catalog."""
    return get_remediation_catalog()


@router.post("/prune")
def prune_findings(
    retention_days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    On-demand storage optimization: permanently purge resolved findings older than retention_days.
    """
    from app.services.scanner_service import prune_stale_findings
    count = prune_stale_findings(db, retention_days=retention_days)
    return {
        "success": True,
        "pruned_count": count,
        "retention_days": retention_days,
        "message": f"Successfully pruned {count} resolved findings older than {retention_days} days.",
    }

