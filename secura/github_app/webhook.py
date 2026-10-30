
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
from secura.github_app.checks import create_check_run
from secura.github_app.pr_scanner import scan_github_pull_request


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
        head_sha = pull_request.get("head", {}).get("sha")

        logger.info(
            "Pull request event received. Action: %s, "
            "Repository: %s, PR number: %s",
            action,
            repository_name,
            pull_number,
        )

        # Process PR creation, reopening, and new commits.
        if action in {"opened", "reopened", "synchronize"}:
            if (
                not repository_name
                or not pull_number
                or not installation_id
                or not head_sha
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Missing repository, PR number, "
                        "installation ID, or head SHA"
                    ),
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

                def fetch_file_content(filename):
                    encoded_path = quote(filename, safe="/")

                    return get_repository_file_content(
                        installation_token=installation_token,
                        owner=owner,
                        repo=repo,
                        path=encoded_path,
                        ref=head_sha,
                    )

                scan_output = scan_github_pull_request(
                    changed_files=changed_files,
                    fetch_file_content=fetch_file_content,
                )

                result = scan_output["result"]
                findings = scan_output["findings"]

                passed = result["passed"]
                score = result["score"]
                counts = result["counts"]
                failures = result["failures"]

                conclusion = "success" if passed else "failure"

                title = (
                    "Secura security scan passed"
                    if passed
                    else "Secura security scan failed"
                )

                summary = (
                    f"**Security score:** {score}/100\n\n"
                    f"**Findings:**\n"
                    f"- Critical: {counts['CRITICAL']}\n"
                    f"- High: {counts['HIGH']}\n"
                    f"- Medium: {counts['MEDIUM']}\n"
                    f"- Low: {counts['LOW']}\n"
                )

                if failures:
                    summary += "\n**Policy failures:**\n"

                    for failure in failures:
                        summary += f"- {failure}\n"

                if findings:
                    summary += "\n**Findings:**\n"

                    for finding in findings:
                        summary += (
                            f"- **{finding.get('severity', 'MEDIUM')}** "
                            f"{finding.get('type', 'Security finding')} "
                            f"in `{finding.get('file', 'unknown')}` "
                            f"at line {finding.get('line', '?')}\n"
                        )

                        recommendation = finding.get("recommendation")

                        if recommendation:
                            summary += (
                                f"  - Recommendation: {recommendation}\n"
                            )

                create_check_run(
                    installation_token=installation_token,
                    owner=owner,
                    repo=repo,
                    head_sha=head_sha,
                    conclusion=conclusion,
                    title=title,
                    summary=summary,
                )

                logger.info(
                    "Secura scan completed for %s PR #%s. "
                    "Conclusion: %s, score: %s",
                    repository_name,
                    pull_number,
                    conclusion,
                    score,
                )

            except RequestException:
                logger.exception(
                    "GitHub API request failed for %s PR #%s",
                    repository_name,
                    pull_number,
                )

                raise HTTPException(
                    status_code=502,
                    detail="Unable to complete GitHub API request",
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