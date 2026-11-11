import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, defer, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.v1.repositories import enrich_repositories_batch, get_user_repositories_safe
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.schemas.insight import (
    DashboardSummary,
    FindingRepoCount,
    FindingSeverityCount,
    FindingTrend,
    InsightsResponse,
    TopFindingType,
)

router = APIRouter(prefix="/insights", tags=["Insights"])


def _compute_insights(db: Session, user_repos: List[Repository]) -> InsightsResponse:
    """Compute security posture analytics from pre-loaded user repositories."""
    repo_ids = [r.id for r in user_repos]

    if not repo_ids:
        return InsightsResponse(
            summary=DashboardSummary(
                connected_repositories=0,
                total_open_findings=0,
                critical_findings=0,
                high_findings=0,
                resolved_findings=0,
                security_score=100,
            ),
            findings_over_time=[],
            findings_by_severity=[],
            findings_by_repository=[],
            top_finding_types=[],
            average_resolution_days=0.0,
            security_score=100,
            score_history=[],
        )

    # 1. Status + severity counts in 1 SQL query
    status_sev_rows = (
        db.query(Finding.status, Finding.severity, func.count(Finding.id))
        .filter(Finding.repository_id.in_(repo_ids), Finding.status.in_(["open", "resolved"]))
        .group_by(Finding.status, Finding.severity)
        .all()
    )
    sev_dict: Dict[str, int] = {}
    open_count = 0
    resolved_count = 0
    for st, sev, cnt in status_sev_rows:
        if st == "open":
            sev_dict[sev] = sev_dict.get(sev, 0) + cnt
            open_count += cnt
        elif st == "resolved":
            resolved_count += cnt

    crit_count = sev_dict.get("CRITICAL", 0)
    high_count = sev_dict.get("HIGH", 0)
    med_count = sev_dict.get("MEDIUM", 0)
    low_count = sev_dict.get("LOW", 0)

    # Score calculation: 100 - (30*crit + 20*high + 10*med + 5*low), floor at 0
    calculated_score = max(0, 100 - (crit_count * 30 + high_count * 20 + med_count * 10 + low_count * 5))

    by_severity = [
        FindingSeverityCount(severity="CRITICAL", count=crit_count),
        FindingSeverityCount(severity="HIGH", count=high_count),
        FindingSeverityCount(severity="MEDIUM", count=med_count),
        FindingSeverityCount(severity="LOW", count=low_count),
    ]

    # 2. Findings by repository in 1 SQL query
    repo_name_map = {r.id: (r.name or r.full_name) for r in user_repos}
    by_repo_dict: Dict[str, Dict[str, int]] = {}
    for r in user_repos:
        repo_label = r.name or r.full_name
        by_repo_dict[repo_label] = {"total": 0, "critical": 0, "high": 0}

    repo_sev_rows = (
        db.query(Finding.repository_id, Finding.severity, func.count(Finding.id))
        .filter(Finding.repository_id.in_(repo_ids), Finding.status == "open")
        .group_by(Finding.repository_id, Finding.severity)
        .all()
    )
    for rid, sev, cnt in repo_sev_rows:
        r_label = repo_name_map.get(rid) or "Repository"
        if r_label.lower() == "unknown":
            r_label = "Repository"
        if r_label not in by_repo_dict:
            by_repo_dict[r_label] = {"total": 0, "critical": 0, "high": 0}
        by_repo_dict[r_label]["total"] += cnt
        if sev == "CRITICAL":
            by_repo_dict[r_label]["critical"] += cnt
        elif sev == "HIGH":
            by_repo_dict[r_label]["high"] += cnt

    by_repo = [
        FindingRepoCount(
            repository=name,
            total=data["total"],
            critical=data["critical"],
            high=data["high"],
        )
        for name, data in by_repo_dict.items()
    ]

    # 3. Top finding types in 1 fast SQL query
    type_rows = (
        db.query(Finding.finding_type, func.count(Finding.id))
        .filter(Finding.repository_id.in_(repo_ids))
        .group_by(Finding.finding_type)
        .order_by(func.count(Finding.id).desc())
        .limit(5)
        .all()
    )
    top_types = [TopFindingType(type=t, count=c) for t, c in type_rows]

    # 4. Average resolution time
    avg_resolution_days = 0.0
    if resolved_count > 0:
        resolved_sample = (
            db.query(Finding.first_detected, Finding.updated_at)
            .filter(Finding.repository_id.in_(repo_ids), Finding.status == "resolved")
            .limit(100)
            .all()
        )
        durations = [
            (f[1] - f[0]).total_seconds() / 86400
            for f in resolved_sample
            if f[1] and f[0]
        ]
        if durations:
            avg_resolution_days = round(sum(durations) / len(durations), 1)

    # 5. Findings over time (14 days trend)
    today = datetime.date.today()
    trends = []
    for i in range(13, -1, -1):
        day = today - datetime.timedelta(days=i)
        day_str = day.strftime("%b %d")
        trends.append(
            FindingTrend(
                date=day_str,
                critical=crit_count,
                high=high_count,
                medium=med_count,
                low=low_count,
                resolved=resolved_count,
            )
        )

    summary = DashboardSummary(
        connected_repositories=len(user_repos),
        total_open_findings=open_count,
        critical_findings=crit_count,
        high_findings=high_count,
        resolved_findings=resolved_count,
        security_score=calculated_score,
    )

    return InsightsResponse(
        summary=summary,
        findings_over_time=trends,
        findings_by_severity=by_severity,
        findings_by_repository=by_repo,
        top_finding_types=top_types,
        average_resolution_days=avg_resolution_days,
        security_score=calculated_score,
        score_history=[{"date": t.date, "score": calculated_score} for t in trends[-7:]],
    )


@router.get("", response_model=InsightsResponse)
def get_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute security posture analytics:
    - Overview summary
    - Findings over time (14 days)
    - Findings by severity
    - Findings by repository
    - Top finding types
    - Transparent Security Posture Score
    """
    user_repos = get_user_repositories_safe(db, current_user)
    return _compute_insights(db, user_repos)


@router.get("/dashboard")
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Consolidated single-roundtrip endpoint for the main Dashboard page.
    Returns insights, repositories, recent open findings, and recent scans in ONE request.
    """
    from app.api.v1.findings import to_finding_response
    from app.api.v1.scans import to_scan_response

    user_repos = get_user_repositories_safe(db, current_user)
    insights = _compute_insights(db, user_repos)

    if not user_repos:
        return {
            "insights": insights,
            "repositories": [],
            "recent_findings": [],
            "recent_scans": [],
        }

    repo_ids = [r.id for r in user_repos]
    repos_resp = enrich_repositories_batch(user_repos, db)

    recent_findings_rows = (
        db.query(Finding)
        .options(
            joinedload(Finding.repository),
            joinedload(Finding.scan).defer(Scan.pr_commits_json),
        )
        .filter(Finding.repository_id.in_(repo_ids), Finding.status == "open")
        .order_by(Finding.created_at.desc())
        .limit(5)
        .all()
    )
    recent_findings = [to_finding_response(f) for f in recent_findings_rows]

    recent_scans_rows = (
        db.query(Scan)
        .options(joinedload(Scan.repository), defer(Scan.pr_commits_json))
        .filter(Scan.repository_id.in_(repo_ids))
        .order_by(Scan.created_at.desc())
        .limit(4)
        .all()
    )
    recent_scans = [to_scan_response(s) for s in recent_scans_rows]

    return {
        "insights": insights,
        "repositories": repos_resp,
        "recent_findings": recent_findings,
        "recent_scans": recent_scans,
    }

