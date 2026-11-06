from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.user import User
from app.schemas.finding import FindingResponse, FindingUpdate
from app.services.scanner_service import get_remediation_catalog

router = APIRouter(prefix="/findings", tags=["Findings"])


def to_finding_response(finding: Finding, repo_name: Optional[str] = None) -> FindingResponse:
    return FindingResponse(
        id=finding.id,
        scan_id=finding.scan_id,
        repository_id=finding.repository_id,
        repository_name=repo_name or (finding.repository.full_name if finding.repository else None),
        rule_id=finding.rule_id,
        finding_type=finding.finding_type,
        severity=finding.severity,
        file_path=finding.file_path,
        line_number=finding.line_number,
        status=finding.status,
        ignore_reason=finding.ignore_reason,
        risk=finding.risk,
        recommendation=finding.recommendation,
        first_detected=finding.first_detected,
        last_detected=finding.last_detected,
        created_at=finding.created_at,
    )


@router.get("", response_model=List[FindingResponse])
def list_findings(
    repository_id: Optional[str] = None,
    scan_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List findings with rich filtering, search, and pagination."""
    query = (
        db.query(Finding)
        .join(Repository)
        .filter(Repository.user_id == current_user.id)
    )

    if repository_id:
        query = query.filter(Finding.repository_id == repository_id)
    if scan_id:
        query = query.filter(Finding.scan_id == scan_id)
    if severity:
        query = query.filter(Finding.severity == severity.upper())
    if status:
        query = query.filter(Finding.status == status.lower())
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Finding.finding_type.ilike(pattern))
            | (Finding.file_path.ilike(pattern))
            | (Finding.rule_id.ilike(pattern))
        )

    findings = query.order_by(Finding.created_at.desc()).offset(skip).limit(limit).all()
    return [to_finding_response(f) for f in findings]


@router.get("/{finding_id}", response_model=FindingResponse)
def get_finding(
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full detail for a finding, including redacted preview and remediation guidance."""
    finding = (
        db.query(Finding)
        .join(Repository)
        .filter(Finding.id == finding_id, Repository.user_id == current_user.id)
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return to_finding_response(finding)


@router.patch("/{finding_id}", response_model=FindingResponse)
def update_finding(
    finding_id: str,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a finding as resolved, open, or ignored with reason."""
    finding = (
        db.query(Finding)
        .join(Repository)
        .filter(Finding.id == finding_id, Repository.user_id == current_user.id)
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
    return to_finding_response(finding)


@router.get("/catalog/remediation")
def get_catalog():
    """Retrieve the complete structured rule-based remediation catalog."""
    return get_remediation_catalog()

