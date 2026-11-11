from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, defer, joinedload, selectinload
from sqlalchemy import func, or_

from app.api.deps import get_current_user, get_user_scope_ids
from app.core.database import get_db
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.schemas.scan import ScanDetailResponse, ScanResponse
from app.api.v1.findings import to_finding_response

router = APIRouter(prefix="/scans", tags=["Scans"])


def to_scan_response(scan: Scan) -> ScanResponse:
    return ScanResponse(
        id=scan.id,
        repository_id=scan.repository_id,
        repository_name=scan.repository.full_name if scan.repository else None,
        commit_sha=scan.commit_sha,
        branch=scan.branch,
        scan_status=scan.scan_status,
        scan_result=scan.scan_result,
        scan_duration=scan.scan_duration,
        score=scan.score,
        total_findings=scan.total_findings,
        critical_count=scan.critical_count,
        high_count=scan.high_count,
        medium_count=scan.medium_count,
        low_count=scan.low_count,
        check_run_id=scan.check_run_id,
        created_at=scan.created_at,
        completed_at=scan.completed_at,
    )


@router.get("", response_model=List[ScanResponse])
def list_scans(
    repository_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List historical scans with pagination."""
    user_ids, gh_handle = get_user_scope_ids(db, current_user)

    query = (
        db.query(Scan)
        .options(joinedload(Scan.repository), defer(Scan.pr_commits_json))
        .join(Repository)
        .filter(
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            )
        )
    )

    if repository_id:
        query = query.filter(Scan.repository_id == repository_id)

    scans = query.order_by(Scan.created_at.desc()).offset(skip).limit(limit).all()
    return [to_scan_response(s) for s in scans]


@router.get("/{scan_id}", response_model=ScanDetailResponse)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details and findings of a specific scan."""
    user_ids, gh_handle = get_user_scope_ids(db, current_user)
    scan = (
        db.query(Scan)
        .options(joinedload(Scan.repository), selectinload(Scan.findings), defer(Scan.pr_commits_json))
        .join(Repository)
        .filter(
            Scan.id == scan_id,
            or_(
                Repository.user_id.in_(user_ids),
                (func.lower(Repository.owner) == gh_handle) if gh_handle else False,
            ),
        )
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan_dict = to_scan_response(scan).model_dump()
    scan_dict["findings"] = [to_finding_response(f) for f in scan.findings]
    return ScanDetailResponse(**scan_dict)

