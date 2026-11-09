import json
import logging
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.finding import Finding
from app.models.installation import GitHubInstallation
from app.models.repository import Repository
from app.models.scan import Scan
from app.models.user import User
from app.services.github_service import verify_webhook_signature
from app.services.scan_runner import (
    execute_pr_scan,
    execute_main_merge_scan,
    execute_main_push_scan,
)

logger = logging.getLogger("secura.webhook")
router = APIRouter(tags=["Webhooks"])


def _find_or_enroll_repo(
    db: Session,
    full_name: str,
    installation_id: int | None,
    repo_data: dict,
) -> Repository | None:
    """Find monitored repository or auto-enroll it if installed via GitHub App."""
    repo = db.query(Repository).filter(func.lower(Repository.full_name) == full_name.lower()).first()
    if not repo and installation_id:
        inst = db.query(GitHubInstallation).filter(
            GitHubInstallation.github_installation_id == installation_id
        ).first()
        if inst:
            owner_part, repo_part = full_name.split("/", 1) if "/" in full_name else (inst.account_name, full_name)
            repo = Repository(
                installation_id=inst.id,
                user_id=inst.user_id,
                github_repo_id=repo_data.get("id") or (abs(hash(full_name)) % 1000000000),
                name=repo_part,
                full_name=full_name,
                owner=owner_part,
                is_private=repo_data.get("private", False),
                is_monitored=True,
                html_url=f"https://github.com/{full_name}",
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)
            logger.info("Auto-enrolled repository %s for GitHub App installation %s", full_name, installation_id)
    return repo


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

            user = None
            if account_name:
                user = db.query(User).filter(func.lower(User.github_username) == account_name.lower()).first()
            if not user:
                existing_inst = db.query(GitHubInstallation).filter(GitHubInstallation.github_installation_id == inst_id).first()
                if existing_inst and existing_inst.user_id:
                    user = db.query(User).filter(User.id == existing_inst.user_id).first()
            if not user:
                user = User(
                    email=f"{account_name.lower()}@users.noreply.github.com" if account_name else "admin@secura.security",
                    name=account_name or "Developer",
                    github_username=account_name,
                    provider="github",
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)

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
            if not inst:
                account = installation_data.get("account", {})
                account_name = account.get("login", "")
                avatar_url = account.get("avatar_url", "")
                user = None
                if account_name:
                    user = db.query(User).filter(func.lower(User.github_username) == account_name.lower()).first()
                if not user:
                    user = User(
                        email=f"{account_name.lower()}@users.noreply.github.com" if account_name else "admin@secura.security",
                        name=account_name or "Developer",
                        github_username=account_name,
                        provider="github",
                        is_active=True,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                inst = GitHubInstallation(
                    user_id=user.id,
                    github_installation_id=inst_id,
                    account_name=account_name,
                    account_avatar_url=avatar_url,
                )
                db.add(inst)
                db.commit()
                db.refresh(inst)

            if inst:
                # Add repositories
                for r in payload.get("repositories_added", []):
                    full_name = r.get("full_name")
                    name = r.get("name")
                    owner = full_name.split("/")[0] if "/" in full_name else inst.account_name
                    repo_id = r.get("id")
                    existing = (
                        db.query(Repository)
                        .filter(
                            (func.lower(Repository.full_name) == full_name.lower())
                            | (Repository.github_repo_id == repo_id if repo_id else False)
                        )
                        .first()
                    )
                    if not existing:
                        new_r = Repository(
                            installation_id=inst.id,
                            user_id=inst.user_id,
                            github_repo_id=repo_id or (abs(hash(full_name)) % 1000000000),
                            name=name,
                            full_name=full_name,
                            owner=owner,
                            is_private=r.get("private", False),
                            is_monitored=True,
                            html_url=f"https://github.com/{full_name}",
                        )
                        db.add(new_r)
                        db.commit()
                        logger.info("Monitored new repository %s for pull request checks", full_name)
                    else:
                        existing.is_monitored = True
                        existing.installation_id = inst.id
                        existing.user_id = inst.user_id
                        if repo_id:
                            existing.github_repo_id = repo_id
                        existing.name = name
                        existing.full_name = full_name
                        existing.owner = owner
                        db.commit()

                # Remove repositories
                for r in payload.get("repositories_removed", []):
                    full_name = r.get("full_name")
                    repo_id = r.get("id")
                    repo_to_del = (
                        db.query(Repository)
                        .filter(
                            (func.lower(Repository.full_name) == full_name.lower())
                            | (Repository.github_repo_id == repo_id if repo_id else False)
                        )
                        .first()
                    )
                    if repo_to_del:
                        repo_to_del.is_monitored = False
                        db.commit()

            return {"status": "success", "event": "installation_repositories", "action": action}

        # 4. Pull Request event
        if x_github_event == "pull_request":
            supported_actions = {"opened", "reopened", "synchronize", "closed"}
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

            repo = _find_or_enroll_repo(db, full_name, installation_id, repo_data)
            if not repo:
                logger.info("Repository %s not monitored by Secura, ignoring PR #%s", full_name, pull_number)
                return {"status": "unmonitored", "repository": full_name}

            # Handle PR closure/merge
            if action == "closed":
                import datetime
                is_merged = bool(pr_data.get("merged", False))
                pr_state = "merged" if is_merged else "closed"
                now_utc = datetime.datetime.now(datetime.timezone.utc)
                dt_merged = now_utc if is_merged else None
                dt_closed = now_utc if not is_merged else None

                from app.api.v1.pull_requests import _update_pr_scans_state, _last_repo_sync
                _last_repo_sync[repo.id] = 0.0

                pr_scans = (
                    db.query(Scan)
                    .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
                    .all()
                )
                if pr_scans:
                    _update_pr_scans_state(db, repo.id, pull_number, pr_state, dt_merged, dt_closed)
                    db.commit()
                else:
                    from app.api.v1.pull_requests import fast_sync_repository_prs
                    fast_sync_repository_prs(db, repo)
                    pr_scans = (
                        db.query(Scan)
                        .filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number)
                        .all()
                    )

                if not is_merged:
                    # PR closed without merging -> mark any remaining open findings as resolved so they don't block
                    pr_scan_ids = [s.id for s in pr_scans]
                    if pr_scan_ids:
                        db.query(Finding).filter(
                            Finding.scan_id.in_(pr_scan_ids),
                            Finding.status == "open",
                        ).update({Finding.status: "resolved"}, synchronize_session=False)
                        db.commit()
                    logger.info("Marked findings for closed PR #%s on %s as resolved", pull_number, full_name)
                else:
                    # PR merged into main -> scan merged changes on main to detect new findings and resolve solved ones!
                    merge_commit_sha = pr_data.get("merge_commit_sha") or head_sha
                    background_tasks.add_task(
                        execute_main_merge_scan,
                        repository_id=repo.id,
                        pull_number=pull_number,
                        merge_commit_sha=merge_commit_sha,
                        head_sha=head_sha,
                        base_branch=base_branch,
                        installation_id=installation_id,
                    )
                    logger.info("Enqueued main branch merge scan for %s PR #%s (%s)", full_name, pull_number, merge_commit_sha[:7] if merge_commit_sha else "")

                logger.info("Updated PR #%s status to %s for %s", pull_number, pr_state, full_name)
                return {
                    "status": "updated",
                    "repository": full_name,
                    "pull_number": pull_number,
                    "state": pr_state,
                }

            # Enqueue dedicated PR security scan immediately for opened/reopened/synchronize
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
                pr_state="open",
            )

            logger.info("Enqueued PR security scan for %s #%s (%s)", full_name, pull_number, head_sha[:7])
            return {
                "status": "enqueued",
                "repository": full_name,
                "pull_number": pull_number,
                "commit": head_sha,
                "action": action,
            }

        # 5. Push event (commits pushed directly or merged into main)
        if x_github_event == "push":
            ref = payload.get("ref", "")
            repo_data = payload.get("repository", {})
            full_name = repo_data.get("full_name")
            inst_data = payload.get("installation", {})
            installation_id = inst_data.get("id")
            after_sha = payload.get("after")
            is_deleted = bool(payload.get("deleted", False))

            if is_deleted or not after_sha or after_sha == "0000000000000000000000000000000000000000":
                return {"status": "ignored", "event": "push", "reason": "branch_deletion"}

            repo = _find_or_enroll_repo(db, full_name, installation_id, repo_data)
            if not repo:
                logger.info("Repository %s not monitored by Secura, ignoring push event", full_name)
                return {"status": "unmonitored", "repository": full_name}

            default_branch = repo.default_branch or "main"
            branch = ref.replace("refs/heads/", "") if ref.startswith("refs/heads/") else ref

            if branch in (default_branch, "main", "master"):
                background_tasks.add_task(
                    execute_main_push_scan,
                    repository_id=repo.id,
                    commit_sha=after_sha,
                    commits=payload.get("commits", []),
                    head_commit=payload.get("head_commit"),
                    branch=branch,
                    installation_id=installation_id,
                )
                logger.info("Enqueued main branch push scan for %s (%s)", full_name, after_sha[:7] if after_sha else "")
                return {"status": "enqueued", "event": "push", "branch": branch, "commit": after_sha}

            return {"status": "ignored", "event": "push", "branch": branch}

        # 6. Check Run / Check Suite / Workflow Run events (Secura Security Gate, GitHub Actions)
        if x_github_event in ("check_run", "check_suite", "workflow_run"):
            event_obj = payload.get(x_github_event, {})
            repo_data = payload.get("repository", {})
            full_name = repo_data.get("full_name")
            head_sha = event_obj.get("head_sha")
            conclusion = (event_obj.get("conclusion") or "").lower()
            status_val = (event_obj.get("status") or "").lower()
            pull_requests_list = event_obj.get("pull_requests") or []
            pr_num = pull_requests_list[0].get("number") if pull_requests_list else None

            repo = db.query(Repository).filter(func.lower(Repository.full_name) == full_name.lower()).first()
            if repo and head_sha:
                target_sha = head_sha[:12] if len(head_sha) >= 12 else head_sha
                scan = (
                    db.query(Scan)
                    .filter(
                        Scan.repository_id == repo.id,
                        (Scan.commit_sha == target_sha) | (Scan.pull_number == pr_num if pr_num else False),
                    )
                    .order_by(Scan.created_at.desc())
                    .first()
                )

                is_fail = conclusion in ("failure", "action_required", "timed_out", "cancelled")
                is_succ = conclusion == "success"

                # Parse findings from check run output
                output = event_obj.get("output") or {}
                output_text = (output.get("summary") or "") + "\n" + (output.get("text") or "")
                parsed_findings = []
                if output_text.strip():
                    for line in output_text.splitlines():
                        clean_ln = line.strip().strip("*").strip()
                        if clean_ln.startswith("[") and " in " in clean_ln:
                            prefix, _, target = clean_ln.partition(" in ")
                            if prefix.startswith("[") and "]" in prefix:
                                sev_str, _, rule_name = prefix[1:].partition("]")
                                target = target.strip().strip("`").strip("*")
                                path_part, _, line_part = target.rpartition(":")
                                line_no = int(line_part) if line_part.isdigit() else 1
                                file_target = path_part if line_part.isdigit() else target
                                if "secura-pr-" in file_target:
                                    _, _, rem = file_target.partition("secura-pr-")
                                    if "/" in rem:
                                        file_target = rem.partition("/")[2]
                                rule_clean = rule_name.strip()
                                parsed_findings.append({
                                    "rule_id": rule_clean,
                                    "type": rule_clean,
                                    "file": file_target,
                                    "line": line_no,
                                    "severity": sev_str.strip(),
                                })

                if not scan:
                    scan = Scan(
                        repository_id=repo.id,
                        commit_sha=target_sha,
                        branch="main",
                        pull_number=pr_num,
                        scan_status="completed" if (is_fail or is_succ) else ("running" if status_val in ("in_progress", "queued") else "completed"),
                        scan_result="failed" if is_fail else ("passed" if is_succ else "pending"),
                        score=0 if is_fail else 100,
                        total_findings=len(parsed_findings),
                        critical_count=sum(1 for f in parsed_findings if f.get("severity") == "CRITICAL"),
                        high_count=sum(1 for f in parsed_findings if f.get("severity") == "HIGH"),
                    )
                    db.add(scan)
                    db.commit()
                    db.refresh(scan)
                    if parsed_findings:
                        from app.services.scan_runner import _reconcile_pr_findings_in_db
                        _reconcile_pr_findings_in_db(db, repo.id, scan.id, pr_num or 1, parsed_findings)
                        db.commit()
                else:
                    if pr_num and not scan.pull_number:
                        scan.pull_number = pr_num
                    if is_fail or is_succ or status_val:
                        scan.scan_status = "completed" if (is_fail or is_succ) else ("running" if status_val in ("in_progress", "queued") else scan.scan_status)
                        scan.scan_result = "failed" if is_fail else ("passed" if is_succ else scan.scan_result)
                        if is_fail:
                            scan.score = 0
                        elif is_succ:
                            scan.score = 100
                            scan.total_findings = 0
                            scan.critical_count = 0
                            scan.high_count = 0
                    if parsed_findings:
                        scan.total_findings = len(parsed_findings)
                        scan.critical_count = sum(1 for f in parsed_findings if f.get("severity") == "CRITICAL")
                        scan.high_count = sum(1 for f in parsed_findings if f.get("severity") == "HIGH")
                        from app.services.scan_runner import _reconcile_pr_findings_in_db
                        _reconcile_pr_findings_in_db(db, repo.id, scan.id, pr_num or scan.pull_number or 1, parsed_findings)
                    elif is_succ:
                        from app.services.scan_runner import _reconcile_pr_findings_in_db
                        _reconcile_pr_findings_in_db(db, repo.id, scan.id, pr_num or scan.pull_number or 1, [])
                    db.commit()

                return {"status": "recorded", "event": x_github_event, "commit": head_sha}

        return {"status": "ignored", "event": x_github_event}

    finally:
        db.close()

