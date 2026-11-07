import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class FindingBase(BaseModel):
    rule_id: str
    finding_type: str
    severity: str
    file_path: str
    line_number: int
    risk: Optional[str] = None
    recommendation: Optional[str] = None


class FindingUpdate(BaseModel):
    status: str  # "open", "resolved", "ignored"
    ignore_reason: Optional[str] = None


class FindingResponse(FindingBase):
    id: str
    scan_id: str
    repository_id: str
    repository_name: Optional[str] = None
    status: str
    ignore_reason: Optional[str] = None
    commit_sha: Optional[str] = None
    detected_in_commit: Optional[str] = None
    resolved_in_commit: Optional[str] = None
    is_resolved: Optional[bool] = False
    pull_number: Optional[int] = None
    branch: Optional[str] = None
    first_detected: datetime.datetime
    last_detected: datetime.datetime
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class FindingFilterParams(BaseModel):
    repository_id: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    rule_id: Optional[str] = None
    search: Optional[str] = None
    skip: int = 0
    limit: int = 50
