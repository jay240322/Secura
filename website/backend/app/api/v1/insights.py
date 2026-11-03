import datetime
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
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
    user_repos = db.query(Repository).filter(Repository.user_id == current_user.id).all()
    repo_ids = [r.id for r in user_repos]

    if not repo_ids:
        # Default empty response if user has no repositories connected yet
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

    all_findings = db.query(Finding).filter(Finding.repository_id.in_(repo_ids)).all()
    open_findings = [f for f in all_findings if f.status == "open"]
    resolved_findings = [f for f in all_findings if f.status == "resolved"]

    crit_count = sum(1 for f in open_findings if f.severity == "CRITICAL")
    high_count = sum(1 for f in open_findings if f.severity == "HIGH")
    med_count = sum(1 for f in open_findings if f.severity == "MEDIUM")
    low_count = sum(1 for f in open_findings if f.severity == "LOW")

    # Score calculation: 100 - (30*crit + 20*high + 10*med + 5*low), floor at 0
    calculated_score = max(0, 100 - (crit_count * 30 + high_count * 20 + med_count * 10 + low_count * 5))

    # Findings by severity
    by_severity = [
        FindingSeverityCount(severity="CRITICAL", count=crit_count),
        FindingSeverityCount(severity="HIGH", count=high_count),
        FindingSeverityCount(severity="MEDIUM", count=med_count),
        FindingSeverityCount(severity="LOW", count=low_count),
    ]

    # Findings by repository
    by_repo_dict: Dict[str, Dict[str, int]] = {}
    for r in user_repos:
        by_repo_dict[r.name] = {"total": 0, "critical": 0, "high": 0}

    for f in open_findings:
        repo_name = f.repository.name if f.repository else "Unknown"
        if repo_name not in by_repo_dict:
            by_repo_dict[repo_name] = {"total": 0, "critical": 0, "high": 0}
        by_repo_dict[repo_name]["total"] += 1
        if f.severity == "CRITICAL":
            by_repo_dict[repo_name]["critical"] += 1
        elif f.severity == "HIGH":
            by_repo_dict[repo_name]["high"] += 1

    by_repo = [
        FindingRepoCount(
            repository=name,
            total=data["total"],
            critical=data["critical"],
            high=data["high"],
        )
        for name, data in by_repo_dict.items()
    ]

    # Top finding types
    type_counts: Dict[str, int] = {}
    for f in all_findings:
        type_counts[f.finding_type] = type_counts.get(f.finding_type, 0) + 1

    top_types = sorted(
        [TopFindingType(type=t, count=c) for t, c in type_counts.items()],
        key=lambda x: x.count,
        reverse=True,
    )[:5]

    # Average resolution time
    avg_resolution_days = 0.0
    if resolved_findings:
        durations = [
            (f.updated_at - f.first_detected).total_seconds() / 86400
            for f in resolved_findings
            if f.updated_at and f.first_detected
        ]
        if durations:
            avg_resolution_days = round(sum(durations) / len(durations), 1)

    # Findings over time (14 days trend)
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
                resolved=len(resolved_findings),
            )
        )

    summary = DashboardSummary(
        connected_repositories=len(user_repos),
        total_open_findings=len(open_findings),
        critical_findings=crit_count,
        high_findings=high_count,
        resolved_findings=len(resolved_findings),
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

