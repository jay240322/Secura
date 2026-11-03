import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class GitHubInstallation(Base):
    __tablename__ = "github_installations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    github_installation_id = Column(Integer, unique=True, index=True, nullable=False)
    account_name = Column(String(255), nullable=False)
    account_avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    user = relationship("User", back_populates="installations")
    repositories = relationship("Repository", back_populates="installation", cascade="all, delete-orphan")

