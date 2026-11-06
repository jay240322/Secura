import datetime
import os
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import OAuthLogin, TokenResponse, UserLogin, UserProfileUpdate, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])
DEFAULT_AUTH_SCHEME = os.getenv("AUTH_SCHEME", "bearer")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user with email and password."""
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email address is required.",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=email_clean,
        name=payload.name or email_clean.split("@")[0].capitalize(),
        password_hash=hash_password(payload.password),
        provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_jwt = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name or ""},
    )

    return TokenResponse(
        access_token=access_jwt,
        token_type=DEFAULT_AUTH_SCHEME,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate existing user with email and password."""
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    access_jwt = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name or ""},
    )

    return TokenResponse(
        access_token=access_jwt,
        token_type=DEFAULT_AUTH_SCHEME,
        user=UserResponse.model_validate(user),
    )


def sanitize_user_display_name(
    name: Optional[str],
    email: str,
    github_username: Optional[str] = None,
    provider: Optional[str] = None,
) -> str:
    """
    Ensure user display name is NEVER a noreply email address.
    Returns the real profile name, clean GitHub handle, or Google display name.
    """
    if name:
        clean = name.strip()
        if "@users.noreply.github.com" in clean:
            clean = clean.split("@")[0].replace("@", "").strip()
        elif "@" in clean and (provider == "github" or github_username):
            clean = github_username or clean.split("@")[0].strip()
        if clean and "@" not in clean:
            return clean

    # Priority 2: clean github username
    if github_username:
        clean_gh = github_username.strip().lstrip("@")
        if "@" in clean_gh:
            clean_gh = clean_gh.split("@")[0]
        if clean_gh:
            return clean_gh

    # Priority 3: extract handle from noreply email
    if "@users.noreply.github.com" in email:
        handle = email.split("@")[0].strip().replace("@", "")
        if handle:
            return handle

    # Priority 4: email prefix or default
    if "@" in email:
        prefix = email.split("@")[0].strip()
        return prefix.capitalize() if prefix else "Developer"

    return "Developer"


@router.post("/oauth", response_model=TokenResponse)
def oauth_sign_in(payload: OAuthLogin, db: Session = Depends(get_db)):
    """Sign in or register using an OAuth provider (GitHub or Google)."""
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email is required for OAuth login.",
        )

    provider_lower = payload.provider.strip().lower()
    gh_handle = payload.provider_id.strip().lstrip("@") if payload.provider_id else None
    if not gh_handle and provider_lower == "github" and "@users.noreply.github.com" in email_clean:
        gh_handle = email_clean.split("@")[0].replace("@", "")

    clean_name = sanitize_user_display_name(
        payload.name,
        email_clean,
        github_username=gh_handle,
        provider=provider_lower,
    )

    avatar = payload.avatar_url
    if not avatar and provider_lower == "github" and gh_handle:
        avatar = f"https://github.com/{gh_handle}.png"

    try:
        user = db.query(User).filter(User.email == email_clean).first()
        if not user and gh_handle:
            user = db.query(User).filter(User.github_username == gh_handle).first()

        if not user:
            user = User(
                email=email_clean,
                name=clean_name,
                avatar_url=avatar,
                provider=provider_lower,
                github_username=gh_handle if provider_lower == "github" else None,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.name = clean_name
            user.provider = provider_lower
            if avatar:
                user.avatar_url = avatar
            elif not user.avatar_url and gh_handle:
                user.avatar_url = f"https://github.com/{gh_handle}.png"

            if provider_lower == "github" and gh_handle:
                user.github_username = gh_handle
            db.commit()
            db.refresh(user)

        if gh_handle and provider_lower == "github":
            from app.models.installation import GitHubInstallation
            from app.models.repository import Repository
            db.query(GitHubInstallation).filter(func.lower(GitHubInstallation.account_name) == gh_handle.lower()).update({GitHubInstallation.user_id: user.id}, synchronize_session=False)
            db.query(Repository).filter(func.lower(Repository.owner) == gh_handle.lower()).update({Repository.user_id: user.id}, synchronize_session=False)
            db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during OAuth sign-in: {exc}",
        )

    access_jwt = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "name": user.name or "",
            "provider": payload.provider,
        },
    )

    return TokenResponse(
        access_token=access_jwt,
        token_type=DEFAULT_AUTH_SCHEME,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve currently authenticated user profile."""
    dirty = False
    clean_name = sanitize_user_display_name(
        current_user.name,
        current_user.email,
        github_username=current_user.github_username,
        provider=current_user.provider,
    )
    if clean_name != current_user.name:
        current_user.name = clean_name
        dirty = True

    if not current_user.github_username and "@users.noreply.github.com" in current_user.email:
        current_user.github_username = current_user.email.split("@")[0].replace("@", "")
        dirty = True

    if not current_user.avatar_url and current_user.github_username:
        current_user.avatar_url = f"https://github.com/{current_user.github_username}.png"
        dirty = True

    if dirty:
        try:
            db.commit()
            db.refresh(current_user)
        except Exception:
            db.rollback()

    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update authenticated user profile information."""
    if payload.name is not None:
        clean_name = payload.name.strip()
        if clean_name:
            current_user.name = clean_name
            db.commit()
            db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("/github/url")
def get_github_oauth_url(redirect_uri: Optional[str] = None):
    """Return the GitHub OAuth authorization URL."""
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GITHUB_CLIENT_ID is not configured in website/backend/.env",
        )
    target_redirect = redirect_uri or "http://localhost:3000/login"
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=read:user,user:email,repo"
        f"&redirect_uri={target_redirect}"
    )
    return {"url": url, "client_id": settings.GITHUB_CLIENT_ID}


@router.post("/github/callback", response_model=TokenResponse)
async def github_oauth_callback(payload: dict, db: Session = Depends(get_db)):
    """Exchange GitHub temporary OAuth code for access token and fetch real user profile."""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth code is required.")

    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured in website/backend/.env",
        )

    # 1. Exchange temporary code for access token and fetch GitHub profile
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
            )
            if token_res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to connect to GitHub OAuth server.")

            token_data = token_res.json()
            gh_access_token = token_data.get("access_token")
            if not gh_access_token:
                error_desc = token_data.get("error_description") or "Invalid code or client credentials."
                raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {error_desc}")

            # 2. Fetch real user profile from GitHub API
            user_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {gh_access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Secura-Security-Scanner",
                },
            )
            if user_res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch user profile from GitHub.")

            gh_user = user_res.json()

            # 3. Fetch verified email if profile email is hidden/null
            email = gh_user.get("email")
            if not email:
                email_res = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {gh_access_token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "Secura-Security-Scanner",
                    },
                )
                if email_res.status_code == 200:
                    emails = email_res.json()
                    for em in emails:
                        if em.get("primary") and em.get("verified"):
                            email = em.get("email")
                            break
                    if not email and emails:
                        email = emails[0].get("email")

            if not email:
                email = f"{gh_user['login']}@users.noreply.github.com"
    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout):
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Network timeout connecting to GitHub API. Please check your internet connection.",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub communication error: {exc}",
        )

    # 4. Save or update user in database with authentic GitHub details
    clean_email = email.strip().lower()
    gh_login = gh_user.get("login") or ""
    gh_id_str = str(gh_user.get("id")) if gh_user.get("id") else None

    try:
        from sqlalchemy import func
        user = None
        if gh_id_str:
            user = db.query(User).filter(User.github_id == gh_id_str).first()
        if not user and gh_login:
            user = db.query(User).filter(func.lower(User.github_username) == gh_login.lower()).first()
        if not user and clean_email:
            user = db.query(User).filter(User.email == clean_email).first()

        clean_name = sanitize_user_display_name(
            gh_user.get("name"),
            clean_email,
            github_username=gh_login,
            provider="github",
        )
        avatar = gh_user.get("avatar_url") or (f"https://github.com/{gh_login}.png" if gh_login else None)

        if not user:
            user = User(
                email=clean_email,
                name=clean_name,
                avatar_url=avatar,
                github_username=gh_login,
                github_id=gh_id_str,
                github_access_token=gh_access_token,
                provider="github",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.github_username = gh_login
            user.name = clean_name
            user.provider = "github"
            if gh_id_str:
                user.github_id = gh_id_str
            user.github_access_token = gh_access_token
            if avatar:
                user.avatar_url = avatar
            db.commit()
            db.refresh(user)

        if gh_login:
            from app.models.installation import GitHubInstallation
            from app.models.repository import Repository
            db.query(GitHubInstallation).filter(func.lower(GitHubInstallation.account_name) == gh_login.lower()).update({GitHubInstallation.user_id: user.id}, synchronize_session=False)
            db.query(Repository).filter(func.lower(Repository.owner) == gh_login.lower()).update({Repository.user_id: user.id}, synchronize_session=False)
            db.commit()
    except Exception as db_err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving user: {db_err}",
        )

    # 5. Generate signed JWT access credential
    access_jwt = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "name": user.name or "",
            "github_username": user.github_username or "",
            "provider": "github",
        },
    )

    return TokenResponse(
        access_token=access_jwt,
        token_type=DEFAULT_AUTH_SCHEME,
        user=UserResponse.model_validate(user),
    )

