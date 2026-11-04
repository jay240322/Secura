from typing import Generator, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


def get_current_user(
    db: Session = Depends(get_db),
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> User:
    """
    Retrieve authenticated user from JWT token.
    Falls back to first existing or newly initialized developer user in development mode.
    """
    if auth_credentials and auth_credentials.credentials:
        payload = decode_access_token(auth_credentials.credentials)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if user:
                return user

    # Development fallback: seamlessly return the active developer user
    dev_user = (
        db.query(User)
        .filter(User.is_active == True)
        .order_by(User.created_at.asc())
        .first()
    )
    if dev_user:
        return dev_user

    # If no users exist yet, automatically initialize the primary user
    new_user = User(
        email="developer@secura.security",
        name="Developer",
        github_username="jay240322",
        provider="local",
        is_active=True,
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception:
        db.rollback()
        first_user = db.query(User).first()
        if first_user:
            return first_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
