import datetime
import uuid
from sqlalchemy import Column, DateTime, String
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class TimestampMixin:
    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

