import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    installation_id = Column(
        String(36),
        ForeignKey("github_installations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    github_repo_id = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    full_name = Column(String(255), unique=True, index=True, nullable=False)
    owner = Column(String(255), nullable=False)
    default_branch = Column(String(100), default="main", nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)
    is_monitored = Column(Boolean, default=True, nullable=False)
    html_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    installation = relationship("GitHubInstallation", back_populates="repositories")
    scans = relationship("Scan", back_populates="repository", cascade="all, delete-orphan", order_by="desc(Scan.created_at)")
    findings = relationship("Finding", back_populates="repository", cascade="all, delete-orphan")

