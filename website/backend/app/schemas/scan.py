import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.finding import FindingResponse


class ScanBase(BaseModel):
    repository_id: str
    commit_sha: str
    branch: str


class ScanCreate(ScanBase):
    pass


class ScanResponse(ScanBase):
    id: str
    repository_name: Optional[str] = None
    scan_status: str
    scan_result: Optional[str] = None
    scan_duration: Optional[float] = None
    score: int
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    check_run_id: Optional[int] = None
    pull_number: Optional[int] = None
    pr_title: Optional[str] = None
    pr_author: Optional[str] = None
    pr_html_url: Optional[str] = None
    base_branch: Optional[str] = None
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScanDetailResponse(ScanResponse):
    findings: List[FindingResponse] = []
