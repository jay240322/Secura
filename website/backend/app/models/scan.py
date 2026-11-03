import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class Scan(Base):
    __tablename__ = "scans"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    repository_id = Column(
        String(36),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    commit_sha = Column(String(64), nullable=False, index=True)
    branch = Column(String(255), nullable=False)
    scan_status = Column(String(32), default="pending", nullable=False)  # pending, running, completed, failed
    scan_result = Column(String(32), nullable=True)  # passed, failed, error
    scan_duration = Column(Float, nullable=True)  # in seconds
    score = Column(Integer, default=100, nullable=False)
    total_findings = Column(Integer, default=0, nullable=False)
    critical_count = Column(Integer, default=0, nullable=False)
    high_count = Column(Integer, default=0, nullable=False)
    medium_count = Column(Integer, default=0, nullable=False)
    low_count = Column(Integer, default=0, nullable=False)
    check_run_id = Column(Integer, nullable=True)
    pull_number = Column(Integer, nullable=True, index=True)
    pr_title = Column(String(255), nullable=True)
    pr_author = Column(String(100), nullable=True)
    pr_html_url = Column(String(512), nullable=True)
    base_branch = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)

    repository = relationship("Repository", back_populates="scans")
    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")

