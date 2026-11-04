import datetime
from sqlalchemy import Column, DateTime, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    github_id = Column(String(64), unique=True, index=True, nullable=True)
    github_username = Column(String(255), nullable=True)
    github_access_token = Column(String(512), nullable=True)
    password_hash = Column(String(255), nullable=True)
    provider = Column(String(32), default="local", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    installations = relationship("GitHubInstallation", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

