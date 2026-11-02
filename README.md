<div align="center">

# 🛡️ SECURA

### **Enterprise DevSecOps Automated Security Gate & Secret Detection**

*Zero-tolerance secret leak prevention, static code analysis (SAST), and dependency vulnerability auditing for GitHub pull requests.*

---

[![Secura Security Gate](https://github.com/jay240322/Secura/actions/workflows/secura.yml/badge.svg)](https://github.com/jay240322/Secura/actions/workflows/secura.yml)
[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=jay240322_Secura&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=jay240322_Secura)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=jay240322_Secura&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=jay240322_Secura)
[![CodeRabbit AI Review](https://img.shields.io/badge/CodeRabbit-AI%20Reviewed-FF5722?logo=coderabbit&logoColor=white)](https://coderabbit.ai/)
[![Codeac.io Protected](https://img.shields.io/badge/Codeac.io-Code%20Quality%20A-00C49F?logo=codeac&logoColor=white)](https://www.codeac.io/)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Multi-Tier Protection Ecosystem](#-multi-tier-protection-ecosystem)
  - [Secura vs SonarQube vs CodeRabbit vs Codeac.io](#secura-vs-sonarqube-vs-coderabbit-vs-codeacio)
- [Key Features](#-key-features)
- [How It Works (Architecture & Pipeline)](#-how-it-works-architecture--pipeline)
- [Detection Capabilities](#-detection-capabilities)
  - [1. Secret & Credential Detection](#1-secret--credential-detection)
  - [2. Static Application Security Testing (SAST)](#2-static-application-security-testing-sast)
  - [3. Software Composition Analysis (SCA)](#3-software-composition-analysis-sca)
- [The Pull Request Merge Gate](#-the-pull-request-merge-gate)
- [Getting Started](#-getting-started)
  - [Option A: GitHub App (Zero Config)](#option-a-github-app-zero-config)
  - [Option B: GitHub Actions Workflow](#option-b-github-actions-workflow)
  - [Option C: Local Developer CLI](#option-c-local-developer-cli)
- [Security Policy Configuration](#-security-policy-configuration)
- [Enforcing Branch Protection in GitHub](#-enforcing-branch-protection-in-github)
- [Running Tests](#-running-tests)
- [License](#-license)

---

## 🚀 Overview

**Secura** is an automated DevSecOps gatekeeper designed to prevent sensitive credentials, vulnerable dependencies, and insecure code from ever entering your production branches (`main`).

Operating as both a managed **GitHub App** and a standalone **GitHub Actions CI/CD workflow**, Secura inspects pull request diffs in real-time. If exposed secrets (AWS keys, GitHub tokens, database passwords, private keys) or security policy violations are found, Secura **fails the check, drops line-by-line annotations on the PR diff, and blocks the merge button**.

When code is clean, Secura issues an instant **Green Checkmark (`✅`)**, allowing developers to merge with confidence and velocity.

---

## 🛡️ Multi-Tier Protection Ecosystem

Secura integrates alongside industry-leading code quality and security platforms to form a complete defense-in-depth pipeline:

```
                               Pull Request Created
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│     SECURA       │            │    SONARQUBE     │            │    CODERABBIT    │
│  Security Gate   │            │  Quality Gate    │            │  AI Code Review  │
│ - Secret Leaks   │            │ - Bugs & Smells  │            │ - Logic Review   │
│ - SAST Injection │            │ - Tech Debt      │            │ - Context Audits │
│ - Merge Blocker  │            │ - Test Coverage  │            │ - PR Summaries   │
└────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
         │                               │                               │
         └───────────────────────┬───────┴───────────────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │       CODEAC.IO       │
                     │ Automated Code Quality│
                     │ - Style & Clean Code  │
                     │ - Static Analysis     │
                     └───────────┬───────────┘
                                 │
                                 ▼
              All Checks Passed? ──► 🟢 MERGE INTO MAIN
```

### Secura vs SonarQube vs CodeRabbit vs Codeac.io

| Capability | 🛡️ **Secura** | 🔍 **SonarQube** | 🐇 **CodeRabbit** | ⚡ **Codeac.io** |
| :--- | :---: | :---: | :---: | :---: |
| **Primary Focus** | **Hardcoded Secrets & Pre-Merge Gate** | **Code Quality & Technical Debt** | **AI Code Review & AST Reasoning** | **Automated Clean Code & Style** |
| **Secret Detection** | ✅ **Specialized (Real-time regex & heuristics)** | ⚠️ Basic Hotspots | ⚠️ Heuristic | ⚠️ Pattern check |
| **Direct Merge Blocking** | ✅ **Native GitHub Check Run failure** | ✅ Quality Gate webhook | 💬 PR Comment guidance | ⚠️ CI build status |
| **In-PR Line Annotations**| ✅ **Exact line badges on diff** | ⚠️ Web UI redirects | ✅ Conversational reviews | ⚠️ Dashboard reports |
| **.env & Config Auditing** | ✅ **Full `.env.*`, YAML, JSON coverage** | ❌ Source files only | ⚠️ General | ⚠️ Linters |
| **Dependency CVE Check** | ✅ **Live OSV Database Lookup** | ⚠️ Enterprise Edition | ⚠️ Advisories | ❌ No |
| **False-Positive Filter** | ✅ **Environment accessor & kwarg smart ignore** | ⚠️ Manual tuning | ✅ LLM Context | ⚠️ Rule suppression |

---

## ✨ Key Features

- **🔒 Real-Time Secret Elimination**: Catches AWS credentials, GitHub tokens, Slack webhooks, Stripe keys, OpenAI/Anthropic keys, private keys, database connection URIs, and `.env` passwords.
- **⚡ Native GitHub Checks Integration**: Employs GitHub Check Runs API (`status: in_progress` -> `status: completed`) with line-level annotations directly in the **Files changed** tab.
- **🚫 Automated Branch Protection**: Blocks the GitHub **"Merge pull request"** button whenever critical or high findings are detected.
- **🧠 Precision False-Positive Filter**: Does not flag environment variables (`process.env`, `os.environ`, `${VAR}`), argument assignments (`token=token`), type hints (`password: str`), or common placeholders (`changeme`, `your_password`).
- **🛡️ SAST Vulnerability Detection**: Identifies syntax-aware SQL injection, dangerous `os.system` command execution, insecure SSL disables (`verify=False`), and weak hashing algorithms (`md5`).
- **📦 SCA Supply Chain Security**: Connects to the **Open Source Vulnerabilities (OSV)** database to scan `requirements.txt`, `package.json`, and `.csproj` manifests for known CVEs.
- **📊 Standardized Reporting**: Outputs machine-readable `secura-report.json` with remediation guidance for every finding.

---

## 🏗️ How It Works (Architecture & Pipeline)

```
[Developer pushes branch & opens PR to main]
                        │
                        ▼
           [GitHub sends Webhook event]
                        │
                        ▼
         [Secura Server: /webhook endpoint]
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
[1. Immediate Status]       [2. Fetch Changed Files]
- Creates Check Run:        - Downloads PR diff files
  "Secura Security Gate"    - Scans for secrets, SAST,
  Status: ⏳ in_progress      and dependencies
         │                             │
         └──────────────┬──────────────┘
                        │
                        ▼
      [Were any secrets / violations detected?]
           /                                \
         YES                                NO
          │                                  │
          ▼                                  ▼
[❌ FAILED - Unsafe to Merge]     [✅ PASSED - Safe to Merge]
- Check Run conclusion: "failure" - Check Run conclusion: "success"
- Red ❌ in the PR checks list    - Green ✅ in the PR checks list
- Diff annotations on secret lines- Clean security summary
- 🚫 Merge button is BLOCKED      - 🟢 USER CAN SAFELY MERGE
```

---

## 🔎 Detection Capabilities

### 1. Secret & Credential Detection

Secura inspects all supported source files, shell scripts, configuration manifests, and `.env` files for high-confidence signatures:

| Provider | Signature / Pattern Detected | Severity |
| :--- | :--- | :---: |
| **AWS** | IAM Access Keys (`AKIA...`), STS Temporary Keys (`ASIA...`, `ABIA...`), 40-char Secret Keys | `CRITICAL` / `HIGH` |
| **GitHub** | Classic PATs (`ghp_...`), Fine-Grained Tokens (`github_pat_...`), OAuth Tokens (`gho_`, `ghs_`, `ghu_`) | `CRITICAL` |
| **Private Keys** | RSA, EC, OpenSSH, DSA, and PGP Private Key blocks, Encrypted Key headers | `CRITICAL` |
| **Databases** | Connection URIs with passwords (`postgres://`, `mysql://`, `mongodb://`, `redis://`, `amqp://`) | `CRITICAL` |
| **Stripe** | Live and Test Secret Keys (`sk_live_...`, `sk_test_...`, `rk_live_...`) | `CRITICAL` |
| **AI Providers** | OpenAI API Keys (`sk-proj-...`), Anthropic Claude Keys (`sk-ant-...`), Hugging Face Tokens (`hf_...`) | `HIGH` |
| **Chat & Webhooks** | Slack Bot/User Tokens (`xoxb-...`), Slack Incoming Webhooks, Discord Tokens & Webhooks, Telegram Bots | `HIGH` |
| **Developer APIs** | Google API Keys (`AIzaSy...`), Google OAuth Client Secrets, SendGrid, Mailgun, Twilio, NPM, PyPI | `HIGH` |
| **Environment Files** | Variables matching `password`, `secret`, `api_key`, `token` in `.env`, `.env.local`, YAML, JSON | `HIGH` |

### 2. Static Application Security Testing (SAST)

| Vulnerability Type | Rule Match Criteria | Severity |
| :--- | :--- | :---: |
| **SQL Injection** | Dynamic string concatenation (`+`, `%`, `.format()`, f-strings) inside `SELECT ... FROM`, `INSERT INTO`, `UPDATE ... SET`, or `DELETE FROM` | `HIGH` |
| **Command Injection** | Untrusted input reaching `os.system()` without subprocess argument arrays | `HIGH` |
| **Insecure Transport** | Disabling TLS verification (`verify=False`) in network requests | `HIGH` |
| **Weak Cryptography** | Using deprecated hashing algorithms (`hashlib.md5()`) in security contexts | `MEDIUM` |

### 3. Software Composition Analysis (SCA)

Secura inspects modified dependency manifests:
- **Python**: `requirements.txt`
- **JavaScript/TypeScript**: `package.json`
- **.NET / C#**: `.csproj`

Each dependency is validated in real-time against the **Open Source Vulnerabilities (OSV)** database.

---

## 🚦 The Pull Request Merge Gate

Secura provides instant visual status directly in GitHub:

### When Violations Are Detected ❌
- **Check Status**: `❌ Secura Security Gate: FAILED - Unsafe to merge`
- **Line Annotations**: Inline error badges appear on the exact file and line number in the **Files changed** tab.
- **Summary Banner**:
  ```markdown
  ## ❌ MERGE BLOCKED: Unsafe to merge into main
  Secura detected 2 potential secrets. Merging this pull request into main is blocked.
  ```
- **Merge Button**: Disabled by GitHub Branch Protection.

### When Code Is Clean & Safe ✅
- **Check Status**: `✅ Secura Security Gate: PASSED - Safe to merge`
- **Summary**: `✅ Secura Security Gate: PASSED. This pull request is safe to merge into main.`
- **Score**: `Security Score: 100/100`
- **Merge Button**: Unlocked and ready to merge.

---

## 🛠️ Getting Started

### Option A: GitHub App (Zero Config)

The easiest way to protect all repositories across your GitHub Organization:
1. Install the **Secura GitHub App** on your organization or repositories.
2. Every new Pull Request will automatically receive the `Secura Security Gate` check run.
3. No configuration files are required in individual repositories.

### Option B: GitHub Actions Workflow

Add `.github/workflows/secura.yml` to your repository:

```yaml
name: Secura Security Scan

on:
  pull_request:
    branches:
      - main
  push:
    branches-ignore:
      - main

permissions:
  contents: read
  checks: write

jobs:
  security-scan:
    name: Secura Security Gate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          python -m pip install --only-binary=:all: "PyYAML==6.0.3"

      - name: Run Secura on changed files
        id: secura
        continue-on-error: true
        run: |
          git fetch origin main || true
          python -m secura.scanner . --changed

      - name: Publish GitHub Security Annotations
        if: always()
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          GITHUB_EVENT_PATH: ${{ github.event_path }}
          GITHUB_SHA: ${{ github.sha }}
        run: |
          if [ -f secura-report.json ]; then
            python -m secura.github_annotations
          fi

      - name: Check Secura Gate Result
        if: steps.secura.outcome == 'failure'
        run: |
          echo "::error::Secura security gate FAILED! Unsafe to merge into main."
          exit 1
```

### Option C: Local Developer CLI

Developers can scan code locally before pushing:

```bash
# Clone and install dependencies
git clone https://github.com/jay240322/Secura.git
cd Secura
pip install -r requirements.txt

# Scan only files changed relative to main (Fast pre-push check)
python -m secura.scanner . --changed

# Scan the entire repository
python -m secura.scanner .
```

---

## ⚙️ Security Policy Configuration

Custom security thresholds are configured in `config/security-policy.yml`:

```yaml
policy:
  # Maximum allowable findings before the gate fails
  max_critical: 0
  max_high: 0
  max_medium: 5
  max_low: 10

  # Minimum required security score (0-100)
  minimum_score: 80
```

---

## 🔒 Enforcing Branch Protection in GitHub

To ensure nobody can bypass Secura's security check before merging:

1. In your GitHub repository, open **Settings** > **Branches**.
2. Under **Branch protection rules**, click **Add branch ruleset** (or edit rule for `main`).
3. Check **"Require status checks to pass before merging"**.
4. In the search box, select **`Secura Security Gate`**.
5. *(Optional)* Select **`SonarQube`**, **`CodeRabbit`**, and **`Codeac.io`** as companion required checks.
6. Click **Save changes**.

---

## 🧪 Running Tests

Secura includes an automated test suite verifying all detection rules, regex patterns, and GitHub checks:

```bash
# Run unit tests with Python
python -m unittest discover tests

# Or run individual test suites
python -c "import tests.test_secrets as t; [getattr(t, f)() for f in dir(t) if f.startswith('test_')]; print('All tests passed!')"
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
