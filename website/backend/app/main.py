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
logger = logging.getLogger("secura.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is created
    if not os.environ.get("TESTING"):
        logger.info("Initializing Secura database tables...")
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Secura database tables checked.")
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

