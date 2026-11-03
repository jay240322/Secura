import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(128), nullable=False, index=True)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(64), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")

