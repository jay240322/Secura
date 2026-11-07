import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    scan_id = Column(String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(
        String(36),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_id = Column(String(512), nullable=False, index=True)
    finding_type = Column(String(255), nullable=False, index=True)
    severity = Column(String(16), nullable=False, index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    file_path = Column(String(512), nullable=False)
    line_number = Column(Integer, nullable=False)
    fingerprint = Column(String(255), nullable=False, index=True)  # Hash of repo+rule+file+line for tracking
    status = Column(String(16), default="open", nullable=False, index=True)  # open, resolved, ignored
    ignore_reason = Column(String(512), nullable=True)
    risk = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    first_detected = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_detected = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    scan = relationship("Scan", back_populates="findings")
    repository = relationship("Repository", back_populates="findings")

