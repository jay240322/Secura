import hashlib
import hmac
import json
import logging
import os
from urllib.parse import quote

from fastapi import FastAPI, Header, HTTPException, Request
from requests.exceptions import RequestException

from secura.github_app.auth import (
    create_installation_token,
    get_pull_request_files,
    get_repository_file_content,
)
from secura.github_app.checks import create_check_run, update_check_run
from secura.github_app.pr_scanner import scan_github_pull_request


app = FastAPI(title="Secura GitHub App")

WEBHOOK_SECRET = os.environ.get("SECURA_WEBHOOK_SECRET")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("secura.github_app")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Secura GitHub App",
    }


@app.post("/webhook")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
    x_github_event: str = Header(default=""),
):
    if not WEBHOOK_SECRET:
        logger.error("SECURA_WEBHOOK_SECRET is not configured")
        raise HTTPException(
            status_code=500,
            detail="Webhook secret is not configured",
        )

    body = await request.body()

    digest = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    expected_signature = f"sha256={digest}"

    if not hmac.compare_digest(
        expected_signature,
        x_hub_signature_256,
    ):
        logger.warning("Invalid webhook signature received")
        raise HTTPException(
            status_code=401,
            detail="Invalid signature",
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        logger.exception("Invalid JSON payload received")
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload",
        )

    action = payload.get("action")

    if x_github_event == "installation":
        logger.info(
            "Installation event received. Action: %s",
            action,
        )
        return {
            "status": "received",
            "event": x_github_event,
            "action": action,
        }

    if x_github_event == "ping":
        return {
            "status": "ok",
            "event": "ping",
        }

    if x_github_event != "pull_request":
        logger.info(
            "Ignoring unsupported GitHub event: %s",
            x_github_event,
        )
        return {
            "status": "ignored",
            "event": x_github_event,
            "action": action,
        }

    pull_request = payload.get("pull_request", {})
    repository = payload.get("repository", {})
    installation = payload.get("installation", {})

    repository_name = repository.get("full_name")
    pull_number = pull_request.get("number")
    installation_id = installation.get("id")
    head_sha = pull_request.get("head", {}).get("sha")

    logger.info(
        "Pull request event received. Action: %s, Repository: %s, PR number: %s",
        action,
        repository_name,
        pull_number,
    )

    supported_actions = {
        "opened",
        "reopened",
        "synchronize",
    }

    if action not in supported_actions:
        logger.info(
            "Ignoring pull request action: %s",
            action,
        )
        return {
            "status": "ignored",
            "event": x_github_event,
            "action": action,
        }

    if (
        not repository_name
        or not pull_number
        or not installation_id
        or not head_sha
    ):
        logger.error(
            "Missing required PR information. "
            "Repository: %s, PR: %s, Installation: %s, SHA: %s",
            repository_name,
            pull_number,
            installation_id,
            head_sha,
        )
        raise HTTPException(
            status_code=400,
            detail=(
                "Missing repository, PR number, "
                "installation ID, or head SHA"
            ),
        )

    check_run_id = None
    installation_token = None
    owner, repo = repository_name.split("/", 1)

    try:
        logger.info(
            "Creating installation token for %s",
            repository_name,
        )
        installation_token = create_installation_token(installation_id)

        # 1. Start Check Run in_progress so the user immediately sees the pending check
        try:
            init_check = create_check_run(
                installation_token=installation_token,
                owner=owner,
                repo=repo,
                head_sha=head_sha,
                status="in_progress",
            )
            check_run_id = init_check.get("id")
        except Exception as exc:
            logger.warning("Could not set check run to in_progress: %s", exc)

        logger.info(
            "Fetching changed files for %s PR #%s",
            repository_name,
            pull_number,
        )
        changed_files = get_pull_request_files(
            installation_token=installation_token,
            owner=owner,
            repo=repo,
            pull_number=pull_number,
        )

        logger.info(
            "Fetched %s changed files",
            len(changed_files),
        )

        def fetch_file_content(filename):
            encoded_path = quote(
                filename,
                safe="/",
            )
            return get_repository_file_content(
                installation_token=installation_token,
                owner=owner,
                repo=repo,
                path=encoded_path,
                ref=head_sha,
            )

        logger.info(
            "Starting Secura scan for %s PR #%s",
            repository_name,
            pull_number,
        )

        scan_output = scan_github_pull_request(
            changed_files=changed_files,
            fetch_file_content=fetch_file_content,
        )

        result = scan_output["result"]
        findings = scan_output["findings"]

        logger.info(
            "Finalizing Secura Check Run for %s PR #%s (findings: %s)",
            repository_name,
            pull_number,
            len(findings),
        )

        # 2. Update existing check run or create completed check run
        if check_run_id:
            check_run = update_check_run(
                installation_token=installation_token,
                owner=owner,
                repo=repo,
                check_run_id=check_run_id,
                findings=findings,
                result=result,
            )
        else:
            check_run = create_check_run(
                installation_token=installation_token,
                owner=owner,
                repo=repo,
                head_sha=head_sha,
                status="completed",
                findings=findings,
                result=result,
            )

        conclusion = check_run.get("conclusion")
        score = result.get("score")

        logger.info(
            "Secura scan completed for %s PR #%s. Conclusion: %s, score: %s",
            repository_name,
            pull_number,
            conclusion,
            score,
        )

        # Persist to Secura website database so live results appear on the dashboard
        try:
            import sys
            from pathlib import Path
            backend_dir = str(Path(__file__).resolve().parents[2] / "website" / "backend")
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)

            from app.services.scan_runner import record_pr_scan_results
            record_pr_scan_results(
                repository_name=repository_name,
                pull_number=pull_number,
                commit_sha=head_sha,
                branch=pull_request.get("head", {}).get("ref", "main"),
                base_branch=pull_request.get("base", {}).get("ref", "main"),
                pr_title=pull_request.get("title"),
                pr_author=pull_request.get("user", {}).get("login"),
                pr_html_url=pull_request.get("html_url"),
                result=result,
                findings=findings,
                check_run_id=check_run_id,
                installation_id=installation_id,
            )
        except Exception as db_err:
            logger.warning("Could not persist PR scan to Secura database: %s", db_err)

        return {
            "status": "completed",
            "event": x_github_event,
            "action": action,
            "repository": repository_name,
            "pull_request": pull_number,
            "conclusion": conclusion,
            "score": score,
            "findings_count": len(findings),
        }

    except HTTPException:
        raise

    except RequestException as exc:
        logger.exception(
            "GitHub API request failed for %s PR #%s",
            repository_name,
            pull_number,
        )
        if check_run_id and installation_token:
            try:
                update_check_run(
                    installation_token=installation_token,
                    owner=owner,
                    repo=repo,
                    check_run_id=check_run_id,
                    conclusion="failure",
                    title="Secura Security Gate: API error",
                    summary="GitHub API request failed during the security scan.",
                )
            except Exception:
                pass

        raise HTTPException(
            status_code=502,
            detail="Unable to complete GitHub API request",
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error while scanning %s PR #%s",
            repository_name,
            pull_number,
        )
        if check_run_id and installation_token:
            try:
                update_check_run(
                    installation_token=installation_token,
                    owner=owner,
                    repo=repo,
                    check_run_id=check_run_id,
                    conclusion="failure",
                    title="Secura Security Gate: Scan error",
                    summary=f"An unexpected error occurred during scan: {exc}",
                )
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail="Unexpected error during Secura scan",
        )
