from typing import List, Dict, Any
from pydantic import BaseModel


class DashboardSummary(BaseModel):
    connected_repositories: int
    total_open_findings: int
    critical_findings: int
    high_findings: int
    resolved_findings: int
    security_score: int


class FindingTrend(BaseModel):
    date: str
    critical: int
    high: int
    medium: int
    low: int
    resolved: int


class FindingSeverityCount(BaseModel):
    severity: str
    count: int


class FindingRepoCount(BaseModel):
    repository: str
    total: int
    critical: int
    high: int


class TopFindingType(BaseModel):
    type: str
    count: int


class InsightsResponse(BaseModel):
    summary: DashboardSummary
    findings_over_time: List[FindingTrend]
    findings_by_severity: List[FindingSeverityCount]
    findings_by_repository: List[FindingRepoCount]
    top_finding_types: List[TopFindingType]
    average_resolution_days: float
    security_score: int
    score_history: List[Dict[str, Any]]

