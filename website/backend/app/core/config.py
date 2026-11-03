import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BASE_DIR = BACKEND_DIR.parent.parent

# Load .env file from website/backend/.env if it exists, otherwise from repo root
backend_env = BACKEND_DIR / ".env"
if backend_env.exists():
    load_dotenv(backend_env)
else:
    load_dotenv(BASE_DIR / ".env")


class Settings(BaseModel):
    PROJECT_NAME: str = "Secura Security Command Center"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database: PostgreSQL with SQLite fallback for local development without DB server
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR}/secura.db",
    )

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://secura.app",
    ]

    # GitHub App Integration (reusing existing env variables)
    GITHUB_APP_ID: str = os.getenv("GITHUB_APP_ID", "")
    GITHUB_PRIVATE_KEY_PATH: str = os.getenv("GITHUB_PRIVATE_KEY_PATH", "")
    SECURA_WEBHOOK_SECRET: str = os.getenv("SECURA_WEBHOOK_SECRET", "")

    # GitHub OAuth for User Dashboard Sign-In
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")

    # JWT Session
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secura-dashboard-super-secret-key-change-in-prod-32bytes")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days


settings = Settings()

