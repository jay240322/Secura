import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    github_username: Optional[str] = None
    provider: Optional[str] = "local"


class UserCreate(UserBase):
    github_id: Optional[str] = None
    password: Optional[str] = None
    provider: Optional[str] = "local"


class UserRegister(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class OAuthLogin(BaseModel):
    provider: str  # "github" | "google"
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    provider_id: Optional[str] = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
