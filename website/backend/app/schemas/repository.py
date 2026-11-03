import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class RepositoryBase(BaseModel):
    name: str
    full_name: str
    owner: str
    default_branch: str = "main"
    is_private: bool = False
    is_monitored: bool = True
    html_url: Optional[str] = None


class RepositoryCreate(BaseModel):
    full_name: str
    name: Optional[str] = None
    owner: Optional[str] = None
    default_branch: str = "main"
    is_private: bool = False
    is_monitored: bool = True
    html_url: Optional[str] = None
    github_repo_id: Optional[int] = None
    installation_id: Optional[str] = None


class RepositoryUpdate(BaseModel):
    is_monitored: Optional[bool] = None
    default_branch: Optional[str] = None


class RepositoryResponse(RepositoryBase):
    id: str
    installation_id: Optional[str] = None
    github_repo_id: Optional[int] = None
    open_findings_count: int = 0
    critical_findings_count: int = 0
    high_findings_count: int = 0
    last_scan_status: Optional[str] = None
    last_scan_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class AvailableRepositoryResponse(BaseModel):
    github_repo_id: Optional[int] = None
    name: str
    full_name: str
    owner: str
    default_branch: str = "main"
    is_private: bool = False
    html_url: Optional[str] = None
    description: Optional[str] = None
    installation_id: Optional[int] = None
    already_monitored: bool = False


class BulkRepositoryAdd(BaseModel):
    repositories: list[RepositoryCreate]

