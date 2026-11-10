import logging
import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings, BASE_DIR

logger = logging.getLogger("secura.database")

Base = declarative_base()


def get_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    clean_db_url = db_url.replace("&channel_binding=require", "").replace("?channel_binding=require", "")
    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

    if clean_db_url.startswith("postgresql"):
        logger.info("Connecting to PostgreSQL database...")
        connect_args = {"connect_timeout": 15}
        if "sslmode=" not in clean_db_url and "localhost" not in clean_db_url and "127.0.0.1" not in clean_db_url:
            connect_args["sslmode"] = "require"
        if is_serverless:
            return create_engine(
                clean_db_url,
                poolclass=NullPool,
                connect_args=connect_args,
            )
        return create_engine(
            clean_db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=10,
            max_overflow=20,
            connect_args=connect_args,
        )
    else:
        if is_serverless and clean_db_url.startswith("sqlite:///") and not clean_db_url.startswith("sqlite:////tmp"):
            clean_db_url = "sqlite:////tmp/secura.db"
        logger.info("Using SQLite database: %s", clean_db_url)
        eng = create_engine(
            clean_db_url,
            connect_args={"check_same_thread": False, "timeout": 30.0},
        )
        @event.listens_for(eng, "connect")
        def set_sqlite_pragma_direct(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA busy_timeout=10000")
            finally:
                cursor.close()
        return eng


def ensure_db_schema(target_engine):
    """Ensure all tables and columns exist across SQLite and PostgreSQL."""
    try:
        Base.metadata.create_all(bind=target_engine)
        is_pg = target_engine.dialect.name == "postgresql"

        if is_pg:
            with target_engine.connect() as conn:
                try:
                    conn.execute(text("""
                        ALTER TABLE scans 
                            ADD COLUMN IF NOT EXISTS pull_number INTEGER,
                            ADD COLUMN IF NOT EXISTS pr_title VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS pr_author VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS pr_html_url VARCHAR(512),
                            ADD COLUMN IF NOT EXISTS base_branch VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS pr_state VARCHAR(32) DEFAULT 'open',
                            ADD COLUMN IF NOT EXISTS pr_merged_at TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS pr_closed_at TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS pr_commits_json TEXT;
                        ALTER TABLE users 
                            ADD COLUMN IF NOT EXISTS github_access_token VARCHAR(512),
                            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'github';
                        ALTER TABLE findings 
                            ALTER COLUMN rule_id TYPE VARCHAR(512),
                            ALTER COLUMN fingerprint TYPE VARCHAR(255),
                            ALTER COLUMN finding_type TYPE VARCHAR(255);
                        CREATE INDEX IF NOT EXISTS idx_scans_repo_created ON scans (repository_id, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_scans_repo_pull ON scans (repository_id, pull_number);
                        CREATE INDEX IF NOT EXISTS idx_findings_repo_status ON findings (repository_id, status);
                        CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings (scan_id);
                    """))
                    conn.commit()
                except Exception:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
        else:
            timestamp_type = "DATETIME"
            new_scan_columns = [
                ("pull_number", "INTEGER"),
                ("pr_title", "VARCHAR(255)"),
                ("pr_author", "VARCHAR(100)"),
                ("pr_html_url", "VARCHAR(512)"),
                ("base_branch", "VARCHAR(100)"),
                ("pr_state", "VARCHAR(32) DEFAULT 'open'"),
                ("pr_merged_at", timestamp_type),
                ("pr_closed_at", timestamp_type),
                ("pr_commits_json", "TEXT"),
            ]
            with target_engine.connect() as conn:
                for col_name, col_type in new_scan_columns:
                    try:
                        conn.execute(text(f"ALTER TABLE scans ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
                user_columns = [
                    ("github_access_token", "VARCHAR(512)"),
                    ("password_hash", "VARCHAR(255)"),
                    ("provider", "VARCHAR(32) DEFAULT 'github'"),
                ]
                for col_name, col_type in user_columns:
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
    except Exception as exc:
        logger.warning("Database schema check warning: %s", exc)


engine = get_engine()
ensure_db_schema(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        db.rollback()
        logger.error(f"Database session error: {exc}")
        raise
    finally:
        db.close()
