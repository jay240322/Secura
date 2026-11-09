import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.findings import router as findings_router
from app.api.v1.insights import router as insights_router
from app.api.v1.pull_requests import router as pull_requests_router
from app.api.v1.repositories import router as repositories_router
from app.api.v1.scans import router as scans_router
from app.api.v1.webhooks import router as webhooks_router
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # Ensure all SQLAlchemy models are registered

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
# Secura API Command Center Application
logger = logging.getLogger("secura.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is created
    if not os.environ.get("TESTING"):
        logger.info("Initializing Secura database tables...")
        try:
            Base.metadata.create_all(bind=engine)
            # Startup profile sanitization: clean any noreply email strings from user names
            from app.core.database import SessionLocal
            from app.models.user import User
            with SessionLocal() as db:
                users = db.query(User).all()
                for u in users:
                    dirty = False
                    if u.email and "@users.noreply.github.com" in u.email:
                        gh_handle = u.email.split("@")[0].replace("@", "").strip()
                        if not u.github_username:
                            u.github_username = gh_handle
                            dirty = True
                        if not u.provider or u.provider == "local":
                            u.provider = "github"
                            dirty = True
                    if u.name and ("@users.noreply.github.com" in u.name or "@" in u.name):
                        clean_n = u.github_username or (u.email.split("@")[0] if u.email else "Developer")
                        u.name = clean_n.replace("@", "")
                        dirty = True
                    if u.github_username and not u.avatar_url:
                        u.avatar_url = f"https://github.com/{u.github_username}.png"
                        dirty = True
                    if dirty:
                        db.commit()

                # Storage optimization: prune resolved findings older than 30 days
                from app.services.scanner_service import prune_stale_findings
                with SessionLocal() as db:
                    prune_stale_findings(db, retention_days=30)

            logger.info("Secura database tables and user records verified.")
        except Exception as e:
            logger.warning(f"Database table initialization warning: {e}")
    logger.info("Secura backend ready.")
    yield
    # Shutdown
    logger.info("Secura backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Secura Developer Security Command Center — REST API",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "service": "Secura Security Command Center Backend",
        "version": settings.VERSION,
    }


# Register all API endpoints
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(repositories_router, prefix=settings.API_V1_STR)
app.include_router(findings_router, prefix=settings.API_V1_STR)
app.include_router(scans_router, prefix=settings.API_V1_STR)
app.include_router(insights_router, prefix=settings.API_V1_STR)
app.include_router(pull_requests_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router)

