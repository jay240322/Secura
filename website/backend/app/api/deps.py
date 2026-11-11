import time
from typing import Dict, List, Optional, Tuple
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

security = HTTPBearer(auto_error=False)

# Short-lived in-process caches to avoid redundant DB roundtrips on every request
_OWNERSHIP_SYNCED_AT: Dict[str, float] = {}
_USER_SCOPE_CACHE: Dict[str, Tuple[List[str], float]] = {}
_OWNERSHIP_TTL_SECONDS = 600.0
_USER_SCOPE_TTL_SECONDS = 60.0


def get_user_scope_ids(db: Session, current_user: User) -> Tuple[List[str], Optional[str]]:
    """Return all User IDs associated with the user's GitHub handle and the lowercase handle."""
    gh_handle = current_user.github_username.lower() if current_user.github_username else None
    if not gh_handle:
        return [current_user.id], None

    now = time.monotonic()
    cache_key = f"{current_user.id}:{gh_handle}"
    cached = _USER_SCOPE_CACHE.get(cache_key)
    if cached and now - cached[1] < _USER_SCOPE_TTL_SECONDS:
        return cached[0], gh_handle

    same_users = db.query(User.id).filter(func.lower(User.github_username) == gh_handle).all()
    user_ids = list(set([u[0] for u in same_users] + [current_user.id]))
    _USER_SCOPE_CACHE[cache_key] = (user_ids, now)
    return user_ids, gh_handle


def _sanitize_and_prepare_user(db: Session, user: User) -> User:
    """Ensure user name, handle, and avatar are clean without running heavy DB writes on every GET."""
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

    now = time.monotonic()
    if user.github_username and (dirty or now - _OWNERSHIP_SYNCED_AT.get(user.id, 0.0) >= _OWNERSHIP_TTL_SECONDS):
        _OWNERSHIP_SYNCED_AT[user.id] = now
        try:
            from app.models.installation import GitHubInstallation
            from app.models.repository import Repository
            gh_user = user.github_username.lower()
            db.query(GitHubInstallation).filter(
                func.lower(GitHubInstallation.account_name) == gh_user,
                GitHubInstallation.user_id != user.id,
            ).update({GitHubInstallation.user_id: user.id}, synchronize_session=False)
            db.query(Repository).filter(
                func.lower(Repository.owner) == gh_user,
                Repository.user_id != user.id,
            ).update({Repository.user_id: user.id}, synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()

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
