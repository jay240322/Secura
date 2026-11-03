import os
import sys
from pathlib import Path

# Set testing environment before any app imports
os.environ["TESTING"] = "1"
backend_dir = Path(__file__).resolve().parent.parent / "website" / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.repository import Repository
from app.models.user import User
from app.models.finding import Finding
from app.models.scan import Scan

# In-memory SQLite with StaticPool so all connections share the same memory DB
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        # Seed test user
        user = User(
            id="test-user-1",
            email="developer@secura.security",
            name="Test Developer",
        )
        db.add(user)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_list_repositories_empty(client):
    response = client.get("/api/repositories")
    assert response.status_code == 200
    assert response.json() == []


def test_findings_filtering(client, test_db):
    # Seed repository
    repo = Repository(
        id="repo-test-1",
        installation_id="inst-1",
        user_id="test-user-1",
        github_repo_id=12345,
        name="backend-service",
        full_name="org/backend-service",
        owner="org",
    )
    test_db.add(repo)
    test_db.commit()

    # Seed scan and finding
    scan = Scan(
        id="scan-test-1",
        repository_id=repo.id,
        commit_sha="abcdef123456",
        branch="main",
        scan_status="completed",
        scan_result="failed",
    )
    test_db.add(scan)
    test_db.commit()

    finding = Finding(
        id="finding-test-1",
        scan_id=scan.id,
        repository_id=repo.id,
        rule_id="AWS_ACCESS_KEY",
        finding_type="AWS Access Key",
        severity="CRITICAL",
        file_path="config/aws.py",
        line_number=14,
        fingerprint="fp1234",
        status="open",
        risk="Exposed AWS credential allows unauthorized access",
        recommendation="Rotate key in IAM console",
    )
    test_db.add(finding)
    test_db.commit()

    # Query all findings
    response = client.get("/api/findings")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["finding_type"] == "AWS Access Key"
    assert items[0]["severity"] == "CRITICAL"

    # Filter by severity
    res_high = client.get("/api/findings?severity=HIGH")
    assert res_high.status_code == 200
    assert len(res_high.json()) == 0

    res_crit = client.get("/api/findings?severity=CRITICAL")
    assert res_crit.status_code == 200
    assert len(res_crit.json()) == 1

    # Update finding status to resolved
    patch_res = client.patch(
        f"/api/findings/{finding.id}",
        json={"status": "resolved"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"


def test_remediation_catalog(client):
    response = client.get("/api/findings/catalog/remediation")
    assert response.status_code == 200
    catalog = response.json()
    assert "AWS Access Key" in catalog
    assert "SQL Injection" in catalog
    assert "risk" in catalog["AWS Access Key"]
    assert "recommendation" in catalog["AWS Access Key"]


def test_insights_generation(client, test_db):
    response = client.get("/api/insights")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "security_score" in data
    assert data["summary"]["security_score"] == 100
