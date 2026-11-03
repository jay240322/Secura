# Secura — Security Command Center (Website & API)

Secura is a developer-focused DevSecOps platform and security command center that detects exposed secrets, SAST vulnerabilities, and insecure dependencies in GitHub repositories.

---

## 🏗️ Architecture

```text
Secura/
├── secura/                       # Core scanner & GitHub App engine (reused directly)
│   ├── scanner.py                # CLI scan orchestrator
│   ├── secrets.py                # High-confidence secret detection
│   ├── sast.py                   # Static analysis rules
│   ├── dependencies.py           # Dependency manifest parsing
│   ├── policy.py                 # Security score & policy gates
│   ├── remediation.py            # Structured remediation catalog
│   └── github_app/               # Checks API & GitHub App webhook
│
├── website/
│   ├── frontend/                 # Next.js 16 Dark-First Dashboard
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/    # Overview: charts, metrics, score ring, recent scans
│   │   │   │   ├── findings/     # Findings management, search, filters
│   │   │   │   │   └── [id]/     # Finding detail: redacted snippet, risk, remediation
│   │   │   │   ├── repositories/ # Repo cards, monitoring toggles, manual scan
│   │   │   │   ├── scan-history/ # Scan records with pagination & score badges
│   │   │   │   ├── insights/     # Security posture analytics & trends
│   │   │   │   ├── pull-requests/# PR Checks API status & branch gates
│   │   │   │   └── settings/     # Account, GitHub App, policy thresholds, theme
│   │   │   └── globals.css       # Tailwind v4 dark-first styling
│   │   └── package.json
│   │
│   └── backend/                  # FastAPI Dashboard & Webhook Backend
│       ├── app/
│       │   ├── main.py           # FastAPI entry point & CORS
│       │   ├── api/v1/           # REST endpoints (repositories, findings, scans, insights)
│       │   ├── core/             # Configuration & SQLAlchemy database engine
│       │   ├── models/           # PostgreSQL/SQLite models (User, Repo, Scan, Finding)
│       │   ├── schemas/          # Pydantic v2 schemas
│       │   └── services/
│       │       ├── scanner_service.py   # Direct bridge to existing secura scanner
│       │       ├── github_service.py    # GitHub App & Checks API integration
│       │       └── scan_runner.py       # Asynchronous background scan worker
│       ├── alembic/              # Database migrations
│       └── requirements.txt
│
└── tests/                        # Automated test suites (34 tests passing)
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+ (Node 22 / 24 recommended)
- PostgreSQL (or local SQLite for zero-config testing)

### 1. Running the Backend

```bash
cd website/backend

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your PostgreSQL URL and GitHub App credentials

# Run database migrations
alembic upgrade head

# Start FastAPI server with hot-reload
export PYTHONPATH=.:../../
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The interactive OpenAPI documentation will be available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### 2. Running the Frontend

```bash
cd website/frontend

# Install packages
npm install --legacy-peer-deps

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

All existing and newly added backend API tests can be executed in one command:

```bash
# Run the complete test suite (34 tests)
PYTHONPATH=website/backend:. pytest tests/
```

### Run individual suites:

```bash
# Core secret detection
pytest tests/test_secrets.py

# SAST static analysis
pytest tests/test_sast.py

# Backend REST API and database
pytest tests/test_backend_api.py
```

---

## 🔒 Security Best Practices

1. **Secret Redaction**: Detected secret values are **never stored** in the database, returned in API payloads, or displayed in the UI.
2. **Deterministic Fingerprints**: Findings are tracked across scans using `sha256(repo_id + rule_id + file + line)` without hashing the secret itself.
3. **Webhook Verification**: All incoming GitHub webhook payloads are validated using HMAC-SHA256 signatures before processing.
4. **Least-Privilege GitHub Tokens**: GitHub App installation tokens are generated on-demand with short lifespans (1 hour) and are never permanently persisted.

---

## 🌐 Deployment on Render

### Service 1: Website Frontend (Web Service / Static Site)

- **Root Directory**: `website/frontend`
- **Build Command**: `npm install --legacy-peer-deps && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: URL of the deployed FastAPI backend

### Service 2: Website Backend (Web Service)

- **Root Directory**: `website/backend`
- **Build Command**: `pip install -r requirements.txt && alembic upgrade head`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `PYTHONPATH`: `.:../../`
  - `DATABASE_URL`: Connection string from your managed PostgreSQL instance
  - `GITHUB_APP_ID`: Your GitHub App ID
  - `GITHUB_PRIVATE_KEY_PATH`: Path or secret with your GitHub App private key
  - `SECURA_WEBHOOK_SECRET`: Secret configured in your GitHub App settings
  - `JWT_SECRET`: Random 32+ character string

