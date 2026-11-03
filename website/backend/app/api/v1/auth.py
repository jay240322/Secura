import datetime
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import OAuthLogin, TokenResponse, UserLogin, UserProfileUpdate, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


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

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name or ""},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
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

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name or ""},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/oauth", response_model=TokenResponse)
def oauth_sign_in(payload: OAuthLogin, db: Session = Depends(get_db)):
    """Sign in or register using an OAuth provider (GitHub or Google)."""
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email is required for OAuth login.",
        )

    try:
        user = db.query(User).filter(User.email == email_clean).first()
        if not user:
            user = User(
                email=email_clean,
                name=payload.name or email_clean.split("@")[0].capitalize(),
                avatar_url=payload.avatar_url,
                provider=payload.provider.lower(),
                github_username=payload.provider_id if payload.provider.lower() == "github" else None,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if payload.avatar_url and not user.avatar_url:
                user.avatar_url = payload.avatar_url
            if payload.name and not user.name:
                user.name = payload.name
            if payload.provider.lower() == "github" and payload.provider_id:
                user.github_username = payload.provider_id
            db.commit()
            db.refresh(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during OAuth sign-in: {exc}",
        )

    token = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "name": user.name or "",
            "provider": payload.provider,
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve currently authenticated user profile."""
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
        f"&scope=read:user,user:email"
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
    try:
        user = db.query(User).filter(User.email == clean_email).first()
        if not user:
            user = User(
                email=clean_email,
                name=gh_user.get("name") or gh_user["login"],
                avatar_url=gh_user.get("avatar_url"),
                github_username=gh_user["login"],
                github_id=str(gh_user["id"]),
                provider="github",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.github_username = gh_user["login"]
            user.github_id = str(gh_user["id"])
            if gh_user.get("avatar_url"):
                user.avatar_url = gh_user["avatar_url"]
            if gh_user.get("name") and not user.name:
                user.name = gh_user["name"]
            db.commit()
            db.refresh(user)
    except Exception as db_err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving user: {db_err}",
        )

    # 5. Generate signed JWT token
    jwt_token = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "name": user.name or "",
            "github_username": user.github_username or "",
            "provider": "github",
        },
    )

    return TokenResponse(
        access_token=jwt_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )

