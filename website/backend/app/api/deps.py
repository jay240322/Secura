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
    Falls back to first existing or newly initialized developer user.
    """
    if auth_credentials and auth_credentials.credentials:
        payload = decode_access_token(auth_credentials.credentials)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if user:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
