import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings, BASE_DIR

logger = logging.getLogger("secura.database")

Base = declarative_base()


def get_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    sqlite_url = f"sqlite:///{BASE_DIR}/secura.db"

    # If configured for PostgreSQL, test the connection
    if not db_url.startswith("sqlite"):
        try:
            # Clean connection string if needed
            clean_db_url = db_url.replace("&channel_binding=require", "").replace("?channel_binding=require", "")
            logger.info("Attempting connection to PostgreSQL...")
            pg_engine = create_engine(
                clean_db_url,
                pool_pre_ping=True,
                pool_recycle=300,
                connect_args={"connect_timeout": 5},
            )
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to PostgreSQL database.")
            return pg_engine
        except Exception as exc:
            logger.warning(
                f"⚠️ PostgreSQL connection failed ({exc}). "
                f"Falling back to local SQLite at {sqlite_url}"
            )
            return create_engine(
                sqlite_url,
                connect_args={"check_same_thread": False, "timeout": 30.0},
            )
    else:
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False, "timeout": 30.0},
        )


def ensure_db_schema(target_engine):
    """Ensure all tables and new columns exist across SQLite and PostgreSQL."""
    try:
        Base.metadata.create_all(bind=target_engine)
        new_columns = [
            ("pull_number", "INTEGER"),
            ("pr_title", "VARCHAR(255)"),
            ("pr_author", "VARCHAR(100)"),
            ("pr_html_url", "VARCHAR(512)"),
            ("base_branch", "VARCHAR(100)"),
        ]
        with target_engine.connect() as conn:
            for col_name, col_type in new_columns:
                try:
                    conn.execute(text(f"ALTER TABLE scans ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
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

