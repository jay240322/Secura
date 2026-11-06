from typing import Generator, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


def _sanitize_and_prepare_user(db: Session, user: User) -> User:
    """Ensure user name, handle, and avatar are always clean and valid."""
    dirty = False
    if user.email and "@users.noreply.github.com" in user.email:
        handle = user.email.split("@")[0].replace("@", "").strip()
        if not user.github_username:
            user.github_username = handle
            dirty = True
        if not user.provider or user.provider == "local":
            user.provider = "github"
            dirty = True

    if user.name and ("@users.noreply.github.com" in user.name or "@" in user.name):
        from app.api.v1.auth import sanitize_user_display_name
        clean = sanitize_user_display_name(
            user.name, user.email, github_username=user.github_username, provider=user.provider
        )
        if clean != user.name:
            user.name = clean
            dirty = True

    if user.github_username and not user.avatar_url:
        user.avatar_url = f"https://github.com/{user.github_username}.png"
        dirty = True

    if dirty:
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
    return user


def get_current_user(
    db: Session = Depends(get_db),
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> User:
    """
    Retrieve authenticated user from JWT token.
    Strictly enforces authentication for multi-tenant data isolation.
    """
    if auth_credentials and auth_credentials.credentials:
        payload = decode_access_token(auth_credentials.credentials)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if user:
                return _sanitize_and_prepare_user(db, user)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
