
import hashlib
import hmac
import json
import logging
import os

from fastapi import FastAPI, Header, HTTPException, Request
from requests.exceptions import RequestException

from secura.github_app.auth import (
    create_installation_token,
    get_pull_request_files,
)


app = FastAPI(title="Secura GitHub App")

WEBHOOK_SECRET = os.environ.get("SECURA_WEBHOOK_SECRET")

logging.basicConfig(level=logging.INFO)
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
        raise HTTPException(
            status_code=401,
            detail="Invalid signature",
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
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

    elif x_github_event == "pull_request":
        pull_request = payload.get("pull_request", {})
        repository = payload.get("repository", {})
        installation = payload.get("installation", {})

        repository_name = repository.get("full_name")
        pull_number = pull_request.get("number")
        installation_id = installation.get("id")

        logger.info(
            "Pull request event received. Action: %s, "
            "Repository: %s, PR number: %s",
            action,
            repository_name,
            pull_number,
        )

        # Process only PR creation, reopening, and new commits.
        if action in {"opened", "reopened", "synchronize"}:
            if not repository_name or not pull_number or not installation_id:
                raise HTTPException(
                    status_code=400,
                    detail="Missing repository, PR number, or installation ID",
                )

            owner, repo = repository_name.split("/", 1)

            try:
                installation_token = create_installation_token(
                    installation_id
                )

                changed_files = get_pull_request_files(
                    installation_token=installation_token,
                    owner=owner,
                    repo=repo,
                    pull_number=pull_number,
                )

            except RequestException:
                logger.exception(
                    "GitHub API request failed for %s PR #%s",
                    repository_name,
                    pull_number,
                )

                raise HTTPException(
                    status_code=502,
                    detail="Unable to retrieve pull request files from GitHub",
                )

            logger.info(
                "Fetched %s changed files from %s PR #%s",
                len(changed_files),
                repository_name,
                pull_number,
            )

            for changed_file in changed_files:
                logger.info(
                    "Changed file: %s",
                    changed_file.get("filename", "unknown"),
                )

    else:
        logger.info(
            "GitHub event received: %s, Action: %s",
            x_github_event,
            action,
        )

    return {
        "status": "received",
        "event": x_github_event,
        "action": action,
    }