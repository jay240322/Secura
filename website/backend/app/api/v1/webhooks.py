import json
import logging
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.installation import GitHubInstallation
from app.models.repository import Repository
from app.models.user import User
from app.services.github_service import verify_webhook_signature
from app.services.scan_runner import execute_pr_scan

logger = logging.getLogger("secura.webhook")
router = APIRouter(tags=["Webhooks"])


@router.post("/webhooks/github")
@router.post("/api/webhooks/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(default=""),
    x_github_event: str = Header(default=""),
):
    """
    Handle GitHub webhooks securely:
    - Verifies HMAC signature
    - Immediately returns 200 OK so GitHub webhook does not time out
    - Executes security scan in background tasks
    """
    body = await request.body()

    # Validate signature if configured
    if not verify_webhook_signature(body, x_hub_signature_256):
        logger.warning("Rejected webhook: invalid signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action")
    db: Session = SessionLocal()

    try:
        # 1. Ping event
        if x_github_event == "ping":
            return {"status": "ok", "event": "ping"}

        # 2. Installation event (GitHub App installed / uninstalled)
        if x_github_event == "installation":
            installation_data = payload.get("installation", {})
            inst_id = installation_data.get("id")
            account = installation_data.get("account", {})
            account_name = account.get("login", "")
            avatar_url = account.get("avatar_url", "")

            user = db.query(User).first()
            if not user:
                user = User(email="admin@secura.security", name="Admin")
                db.add(user)
                db.commit()

            if action == "created":
                inst = GitHubInstallation(
                    user_id=user.id,
                    github_installation_id=inst_id,
                    account_name=account_name,
                    account_avatar_url=avatar_url,
                )
                db.add(inst)
                db.commit()

                # Sync repositories in payload if present
                for r in payload.get("repositories", []):
                    repo_id = r.get("id")
                    full_name = r.get("full_name")
                    name = r.get("name")
                    owner = full_name.split("/")[0] if "/" in full_name else account_name
                    repo = Repository(
                        installation_id=inst.id,
                        user_id=user.id,
                        github_repo_id=repo_id,
                        name=name,
                        full_name=full_name,
                        owner=owner,
                        is_private=r.get("private", False),
                        is_monitored=True,
                    )
                    db.add(repo)
                db.commit()
                logger.info("Created GitHub Installation %s for %s", inst_id, account_name)

            elif action == "deleted":
                inst = db.query(GitHubInstallation).filter(
                    GitHubInstallation.github_installation_id == inst_id
                ).first()
                if inst:
                    db.delete(inst)
                    db.commit()
                    logger.info("Deleted GitHub Installation %s", inst_id)

            return {"status": "success", "event": "installation", "action": action}

        # 3. Installation Repositories event (user added / removed repositories)
        if x_github_event == "installation_repositories":
            installation_data = payload.get("installation", {})
            inst_id = installation_data.get("id")
            inst = (
                db.query(GitHubInstallation)
                .filter(GitHubInstallation.github_installation_id == inst_id)
                .first()
            )
            if inst:
                # Add repositories
                for r in payload.get("repositories_added", []):
                    full_name = r.get("full_name")
                    name = r.get("name")
                    owner = full_name.split("/")[0] if "/" in full_name else inst.account_name
                    existing = db.query(Repository).filter(Repository.full_name == full_name).first()
                    if not existing:
                        new_r = Repository(
                            installation_id=inst.id,
                            user_id=inst.user_id,
                            github_repo_id=r.get("id"),
                            name=name,
                            full_name=full_name,
                            owner=owner,
                            is_private=r.get("private", False),
                            is_monitored=True,
                        )
                        db.add(new_r)
                        db.commit()
                        logger.info("Monitored new repository %s for pull request checks", full_name)
                    else:
                        existing.is_monitored = True
                        db.commit()

                # Remove repositories
                for r in payload.get("repositories_removed", []):
                    full_name = r.get("full_name")
                    repo_to_del = db.query(Repository).filter(Repository.full_name == full_name).first()
                    if repo_to_del:
                        db.delete(repo_to_del)
                        db.commit()

            return {"status": "success", "event": "installation_repositories", "action": action}

        # 4. Pull Request event
        if x_github_event == "pull_request":
            supported_actions = {"opened", "reopened", "synchronize"}
            if action not in supported_actions:
                return {"status": "ignored", "action": action}

            pr_data = payload.get("pull_request", {})
            repo_data = payload.get("repository", {})
            inst_data = payload.get("installation", {})

            full_name = repo_data.get("full_name")
            pull_number = pr_data.get("number")
            pr_title = pr_data.get("title")
            pr_author = pr_data.get("user", {}).get("login")
            pr_html_url = pr_data.get("html_url")
            head_sha = pr_data.get("head", {}).get("sha", "HEAD")
            branch = pr_data.get("head", {}).get("ref", "main")
            base_branch = pr_data.get("base", {}).get("ref", "main")
            installation_id = inst_data.get("id")

            repo = db.query(Repository).filter(Repository.full_name == full_name).first()
            if not repo:
                logger.info("Repository %s not monitored by Secura, ignoring PR #%s", full_name, pull_number)
                return {"status": "unmonitored", "repository": full_name}

            # Enqueue dedicated PR security scan immediately
            background_tasks.add_task(
                execute_pr_scan,
                repository_id=repo.id,
                pull_number=pull_number,
                commit_sha=head_sha,
                branch=branch,
                base_branch=base_branch,
                pr_title=pr_title,
                pr_author=pr_author,
                pr_html_url=pr_html_url,
                installation_id=installation_id,
            )

            logger.info("Enqueued PR security scan for %s #%s (%s)", full_name, pull_number, head_sha[:7])
            return {
                "status": "enqueued",
                "repository": full_name,
                "pull_number": pull_number,
                "commit": head_sha,
                "action": action,
            }

        return {"status": "ignored", "event": x_github_event}

    finally:
        db.close()

