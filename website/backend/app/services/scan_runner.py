import datetime
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan import Scan
from app.services.scanner_service import compute_finding_fingerprint, map_type_to_rule_id, run_full_scan
from app.services.github_service import trigger_check_run, trigger_pr_comment
from secura.github_app.auth import (
    create_installation_token,
    get_pull_request_files,
    get_repository_file_content,
    get_repository_tree,
)
from secura.secrets import scan_content as scan_secrets_content
from secura.sast import scan_content as scan_sast_content
from secura.pr_changes import is_scannable_file
from secura.policy import evaluate_policy, load_policy

logger = logging.getLogger("secura.scan_runner")


def persist_scan_findings(
    db: Session,
    scan_id: str,
    repository_id: str,
    findings_data: List[Dict[str, Any]],
    default_recommendation: Optional[str] = None,
) -> None:
    """Save findings records to DB with fingerprint deduplication and status tracking."""
    now = datetime.datetime.now(datetime.timezone.utc)
    for item in findings_data:
        f_type = item.get("type", "Unknown")
        rule_id = map_type_to_rule_id(f_type)
        f_path = str(item.get("file", ""))
        line_no = int(item.get("line", 1))
        sev = str(item.get("severity", "MEDIUM")).upper()

        fingerprint = compute_finding_fingerprint(repository_id, rule_id, f_path, line_no)

        existing_finding = (
            db.query(Finding)
            .filter(
                Finding.repository_id == repository_id,
                Finding.fingerprint == fingerprint,
            )
            .first()
        )

        rec = item.get("recommendation") or default_recommendation
        if existing_finding:
            existing_finding.status = "open"
            existing_finding.scan_id = scan_id
            existing_finding.severity = sev
            existing_finding.line_number = line_no
            existing_finding.last_detected = now
            if rec:
                existing_finding.recommendation = rec
        else:
            finding_record = Finding(
                scan_id=scan_id,
                repository_id=repository_id,
                rule_id=rule_id,
                finding_type=f_type,
                severity=sev,
                file_path=f_path,
                line_number=line_no,
                fingerprint=fingerprint,
                status="open",
                risk=item.get("risk"),
                recommendation=rec,
                first_detected=now,
                last_detected=now,
            )
            db.add(finding_record)

    db.commit()


def _get_repo_token_and_names(
    db: Session,
    repository_id: str,
    installation_id: Optional[int] = None,
) -> Tuple[Optional[Repository], Optional[str], str, str, Optional[int]]:
    repo = db.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        return None, None, "", "", None
    inst_id = installation_id or (repo.installation.github_installation_id if repo.installation else None)
    token = None
    if inst_id:
        try:
            token = create_installation_token(inst_id)
        except Exception as e:
            logger.warning("Could not obtain token: %s", e)
    owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)
    return repo, token, owner, repo_name, inst_id


def execute_repository_scan(
    repository_id: str,
    commit_sha: str = "HEAD",
    branch: str = "main",
    directory_to_scan: Optional[str] = None,
    installation_id: Optional[int] = None,
):
    """
    Background worker that runs a scan, saves findings to DB, and updates GitHub checks.
    Uses its own DB session so it can run asynchronously in BackgroundTasks or Celery.
    """
    db: Session = SessionLocal()
    start_time = time.time()

    scan = Scan(
        repository_id=repository_id,
        commit_sha=commit_sha[:12],
        branch=branch,
        scan_status="running",
        score=100,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    try:
        repo, token, owner, repo_name, inst_id = _get_repo_token_and_names(db, repository_id, installation_id)
        if not repo:
            logger.error("Repository %s not found for scan %s", repository_id, scan.id)
            scan.scan_status = "failed"
            scan.scan_result = "error"
            db.commit()
            return

        target_branch = branch or repo.default_branch or "main"

        findings_data: List[Dict[str, Any]] = []
        result: Dict[str, Any] = {"passed": True, "counts": {}, "score": 100}

        if token:
            # Remote repository: fetch file tree from GitHub and scan scannable files
            tree = get_repository_tree(token, owner, repo_name, ref=target_branch)
            for item in tree:
                path = item.get("path", "")
                blob_type = item.get("type", "")
                size = item.get("size", 0)
                if blob_type != "blob" or not is_scannable_file(path) or size > 300_000:
                    continue
                try:
                    content = get_repository_file_content(token, owner, repo_name, path, ref=target_branch)
                    if content:
                        findings_data.extend(scan_secrets_content(content, file_path=path))
                        findings_data.extend(scan_sast_content(content, file_path=path))
                except Exception as file_err:
                    logger.warning("Could not read file %s: %s", path, file_err)
            policy = load_policy()
            result = evaluate_policy(findings_data, policy)
        elif directory_to_scan and os.path.isdir(directory_to_scan):
            scan_output = run_full_scan(directory_to_scan)
            result = scan_output["result"]
            findings_data = scan_output["findings"]
        else:
            logger.info("No remote GitHub token or local directory for %s", repo.full_name)

        duration = round(time.time() - start_time, 2)
        counts = result.get("counts", {})

        scan.scan_status = "completed"
        scan.scan_result = "passed" if result.get("passed", True) and len(findings_data) == 0 else "failed"
        scan.score = result.get("score", 100 if len(findings_data) == 0 else 0)
        scan.total_findings = len(findings_data)
        scan.critical_count = counts.get("CRITICAL", 0)
        scan.high_count = counts.get("HIGH", 0)
        scan.medium_count = counts.get("MEDIUM", 0)
        scan.low_count = counts.get("LOW", 0)
        scan.scan_duration = duration
        scan.completed_at = datetime.datetime.now(datetime.timezone.utc)

        # Reconcile findings on this branch: keep solved findings marked as "resolved"
        now = datetime.datetime.now(datetime.timezone.utc)
        detected_fps = {
            compute_finding_fingerprint(repository_id, map_type_to_rule_id(item.get("type", "Unknown")), str(item.get("file", "")), int(item.get("line", 1)))
            for item in findings_data
        }
        detected_file_rules = {
            (str(item.get("file", "")), map_type_to_rule_id(item.get("type", "Unknown")))
            for item in findings_data
        }

        existing_branch_findings = (
            db.query(Finding)
            .join(Scan)
            .filter(
                Scan.repository_id == repository_id,
                Scan.branch == target_branch,
            )
            .all()
        )

        for ef in existing_branch_findings:
            if ef.fingerprint not in detected_fps and (ef.file_path, ef.rule_id) not in detected_file_rules:
                ef.status = "resolved"
                ef.last_detected = now
            else:
                ef.status = "open"
                ef.scan_id = scan.id
                ef.last_detected = now

        existing_fps = {ef.fingerprint for ef in existing_branch_findings}
        brand_new = [
            item for item in findings_data
            if compute_finding_fingerprint(
                repository_id,
                map_type_to_rule_id(item.get("type", "Unknown")),
                str(item.get("file", "")),
                int(item.get("line", 1)),
            ) not in existing_fps
        ]
        if brand_new:
            persist_scan_findings(db, scan.id, repository_id, brand_new)

        # Update repository stats
        repo.last_scanned_at = datetime.datetime.now(datetime.timezone.utc)
        repo.last_scan_status = scan.scan_result
        db.commit()

        logger.info(
            "Scan %s for repo %s completed in %ss with %s findings",
            scan.id,
            repo.full_name,
            duration,
            len(findings_data),
        )

        # Update GitHub Check Run if installation ID is present
        if inst_id:
            owner, repo_name = repo.full_name.split("/", 1)
            trigger_check_run(
                installation_id=inst_id,
                owner=owner,
                repo=repo_name,
                head_sha=commit_sha,
                status="completed",
                findings=findings_data,
                result=result,
            )

    except Exception as exc:
        logger.exception("Scan %s failed unexpectedly: %s", scan.id, exc)
        scan.scan_status = "failed"
        scan.scan_result = "error"
        scan.scan_duration = round(time.time() - start_time, 2)
        db.commit()

    finally:
        db.close()


def _get_or_create_pr_scan(
    db: Session,
    repository_id: str,
    pull_number: int,
    commit_sha: str = "HEAD",
    branch: str = "main",
    base_branch: str = "main",
    pr_title: Optional[str] = None,
    pr_author: Optional[str] = None,
    pr_html_url: Optional[str] = None,
    pr_state: Optional[str] = "open",
    pr_merged_at: Optional[datetime.datetime] = None,
    pr_closed_at: Optional[datetime.datetime] = None,
    default_owner: str = "",
    default_repo_name: str = "",
) -> Scan:
    short_sha = commit_sha[:12] if commit_sha else "HEAD"
    # Find existing scan for this PR (by repo, pull_number, and matching sha or newest)
    scan = (
        db.query(Scan)
        .filter(
            Scan.repository_id == repository_id,
            Scan.pull_number == pull_number,
        )
        .order_by(Scan.created_at.desc())
        .first()
    )
    if not scan:
        fallback_url = (
            f"https://github.com/{default_owner}/{default_repo_name}/pull/{pull_number}"
            if default_owner
            else None
        )
        scan = Scan(
            repository_id=repository_id,
            commit_sha=short_sha,
            branch=branch,
            base_branch=base_branch,
            pull_number=pull_number,
            pr_title=pr_title or f"Pull Request #{pull_number}",
            pr_author=pr_author or default_owner,
            pr_html_url=pr_html_url or fallback_url,
            pr_state=pr_state or "open",
            pr_merged_at=pr_merged_at,
            pr_closed_at=pr_closed_at,
            scan_status="running",
            score=100,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
    else:
        scan.commit_sha = short_sha
        scan.branch = branch
        scan.base_branch = base_branch
        scan.scan_status = "running"
        if pr_title:
            scan.pr_title = pr_title
        if pr_author:
            scan.pr_author = pr_author
        if pr_html_url:
            scan.pr_html_url = pr_html_url
        if pr_state:
            scan.pr_state = pr_state
        if pr_merged_at:
            scan.pr_merged_at = pr_merged_at
        if pr_closed_at:
            scan.pr_closed_at = pr_closed_at
        db.commit()
        if pr_html_url:
            scan.pr_html_url = pr_html_url
        if pr_state:
            scan.pr_state = pr_state
        if pr_merged_at:
            scan.pr_merged_at = pr_merged_at
        if pr_closed_at:
            scan.pr_closed_at = pr_closed_at
        db.commit()
    return scan


def _finalize_pr_scan_metrics(
    scan: Scan,
    eval_result: Dict[str, Any],
    findings_data: List[Dict[str, Any]],
    duration: Optional[float] = None,
    check_run_id: Optional[int] = None,
) -> None:
    counts = eval_result.get("counts", {})
    has_violations = not eval_result.get("passed", True) or len(findings_data) > 0 and (
        counts.get("CRITICAL", 0) > 0 or counts.get("HIGH", 0) > 0
    )
    scan.scan_status = "completed"
    scan.scan_result = "failed" if (has_violations or len(findings_data) > 0) else "passed"
    scan.score = eval_result.get("score", 100 if len(findings_data) == 0 else 0)
    scan.total_findings = len(findings_data)
    scan.critical_count = counts.get("CRITICAL", 0)
    scan.high_count = counts.get("HIGH", 0)
    scan.medium_count = counts.get("MEDIUM", 0)
    scan.low_count = counts.get("LOW", 0)
    if duration is not None:
        scan.scan_duration = duration
    if check_run_id is not None:
        scan.check_run_id = check_run_id
    scan.completed_at = datetime.datetime.now(datetime.timezone.utc)


def _reconcile_pr_findings_in_db(
    db: Session,
    repo_id: str,
    scan_id: str,
    pull_number: int,
    findings_data: List[Dict[str, Any]],
) -> None:
    pr_scans = (
        db.query(Scan)
        .filter(
            Scan.repository_id == repo_id,
            Scan.pull_number == pull_number,
        )
        .all()
    )
    pr_scan_ids = [s.id for s in pr_scans]
    existing_pr_findings = (
        db.query(Finding)
        .filter(Finding.scan_id.in_(pr_scan_ids))
        .all()
        if pr_scan_ids
        else []
    )

    now = datetime.datetime.now(datetime.timezone.utc)
    detected_fps = {
        compute_finding_fingerprint(
            repo_id,
            map_type_to_rule_id(item.get("type", "Unknown")),
            str(item.get("file", "")),
            int(item.get("line", 1)),
        )
        for item in findings_data
    }
    detected_file_rules = {
        (str(item.get("file", "")), map_type_to_rule_id(item.get("type", "Unknown")))
        for item in findings_data
    }

    for ef in existing_pr_findings:
        if ef.fingerprint not in detected_fps and (ef.file_path, ef.rule_id) not in detected_file_rules:
            ef.status = "resolved"
            ef.last_detected = now
        else:
            ef.status = "open"
            ef.scan_id = scan_id
            ef.last_detected = now

    existing_fps = {ef.fingerprint for ef in existing_pr_findings}
    brand_new = [
        item for item in findings_data
        if compute_finding_fingerprint(
            repo_id,
            map_type_to_rule_id(item.get("type", "Unknown")),
            str(item.get("file", "")),
            int(item.get("line", 1)),
        ) not in existing_fps
    ]
    if brand_new:
        persist_scan_findings(
            db,
            scan_id,
            repo_id,
            brand_new,
            default_recommendation="Remove credential or secret from pull request.",
        )
    elif not findings_data:
        curr_scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if curr_scan:
            curr_scan.total_findings = 0
            curr_scan.critical_count = 0
            curr_scan.high_count = 0
            curr_scan.medium_count = 0
            curr_scan.low_count = 0
            curr_scan.scan_result = "passed"
            curr_scan.score = 100


def execute_pr_scan(
    repository_id: str,
    pull_number: int,
    commit_sha: str = "HEAD",
    branch: str = "main",
    base_branch: str = "main",
    pr_title: Optional[str] = None,
    pr_author: Optional[str] = None,
    pr_html_url: Optional[str] = None,
    installation_id: Optional[int] = None,
    pr_state: Optional[str] = "open",
    pr_merged_at: Optional[datetime.datetime] = None,
    pr_closed_at: Optional[datetime.datetime] = None,
):
    """
    Dedicated background worker for scanning Pull Requests:
    1. Fetches only files changed in this PR from GitHub App API (or public GitHub API).
    2. Deep scans files for credentials, tokens, secrets, and SAST rules.
    3. Evaluates security policy & score.
    4. Posts/updates the GitHub Pull Request security comment.
    5. Creates the GitHub Check Run with annotations.
    6. Stores PR scan and findings into the database for the website dashboard.
    """
    db: Session = SessionLocal()
    start_time = time.time()
    scan_meta = {
        "commit_sha": commit_sha,
        "branch": branch,
        "base_branch": base_branch,
        "pr_title": pr_title,
        "pr_author": pr_author,
        "pr_html_url": pr_html_url,
        "pr_state": pr_state,
        "pr_merged_at": pr_merged_at,
        "pr_closed_at": pr_closed_at,
    }
    scan = _get_or_create_pr_scan(db, repository_id, pull_number, **scan_meta)

    try:
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            logger.error("Repository %s not found for PR scan %s", repository_id, scan.id)
            scan.scan_status = "failed"
            scan.scan_result = "error"
            db.commit()
            return

        if not pr_author:
            scan.pr_author = repo.owner
        if not pr_html_url:
            scan.pr_html_url = f"https://github.com/{repo.full_name}/pull/{pull_number}"
        if not pr_title:
            scan.pr_title = f"Pull Request #{pull_number} ({branch})"

        inst_id = installation_id or (repo.installation.github_installation_id if repo.installation else None)
        owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else (repo.owner, repo.name)

        user_token = None
        if not inst_id:
            from app.models.installation import GitHubInstallation
            inst = (
                db.query(GitHubInstallation)
                .filter(
                    or_(
                        func.lower(GitHubInstallation.account_name) == owner.lower(),
                        GitHubInstallation.user_id == repo.user_id,
                    )
                )
                .first()
            )
            if inst:
                inst_id = inst.github_installation_id

        user_access = None
        if repo.user_id:
            from app.models.user import User
            u = db.query(User).filter(User.id == repo.user_id).first()
            if u:
                user_access = getattr(u, "github_access_token", None)

        # Store PR commits (fetch all commits from GitHub)
        try:
            curr_commits = []
            if scan.pr_commits_json:
                try:
                    curr_commits = json.loads(scan.pr_commits_json)
                except Exception:
                    curr_commits = []
            from app.services.github_service import get_pull_request_commits
            raw_commits = get_pull_request_commits(inst_id, owner, repo_name, pull_number, user_token=user_access)
            if raw_commits and (len(curr_commits) <= 1 or len(raw_commits) >= len(curr_commits)):
                scan.pr_commits_json = json.dumps(raw_commits)
                db.commit()
            elif not scan.pr_commits_json:
                short_sha = commit_sha[:7] if len(commit_sha) >= 7 else commit_sha
                raw_commits = [
                    {
                        "sha": short_sha,
                        "full_sha": commit_sha,
                        "message": pr_title or f"Commit {short_sha} for PR #{pull_number}",
                        "author": pr_author or repo.owner,
                        "author_avatar": None,
                        "date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "html_url": pr_html_url or f"https://github.com/{repo.full_name}/commit/{commit_sha}",
                    }
                ]
                scan.pr_commits_json = json.dumps(raw_commits)
                db.commit()
        except Exception as commit_err:
            logger.warning("Error updating PR commits in execute_pr_scan: %s", commit_err)

        findings_data: List[Dict[str, Any]] = []

        # 1. Fetch files changed in the PR from GitHub
        token = None
        if inst_id:
            try:
                token = create_installation_token(inst_id)
            except Exception as token_err:
                logger.warning("Could not obtain installation token for %s: %s", inst_id, token_err)
        if not token and user_access:
            token = user_access

        try:
            pr_files = get_pull_request_files(token, owner, repo_name, pull_number)
            logger.info("PR #%s changed files count: %s", pull_number, len(pr_files))

            for f in pr_files:
                filename = f.get("filename")
                if not filename:
                    continue

                # Filter scannable files
                if not is_scannable_file(filename):
                    continue

                # Fetch file content at head_sha
                try:
                    ref_to_fetch = commit_sha if commit_sha and commit_sha != "HEAD" else (branch or "main")
                    content = get_repository_file_content(token, owner, repo_name, filename, ref_to_fetch)
                    if content:
                        sec_findings = scan_secrets_content(content, file_path=filename)
                        findings_data.extend(sec_findings)

                        sast_findings = scan_sast_content(content, file_path=filename)
                        findings_data.extend(sast_findings)
                except Exception as content_err:
                    logger.warning("Could not fetch PR file content for %s: %s", filename, content_err)
        except Exception as gh_err:
            logger.warning("GitHub API PR fetch failed: %s. Falling back to local diff scan.", gh_err)

        # 2. Fallback to local scan ONLY IF no remote files could be fetched (e.g. offline dev testing without GitHub App)
        if not pr_files and not token:
            from secura.scanner import scan_changed_files
            try:
                findings_data = scan_changed_files(".", base_ref=base_branch)
            except Exception:
                pass

        # 3. Evaluate findings with security policy
        policy = load_policy()
        eval_result = evaluate_policy(findings_data, policy)
        duration = round(time.time() - start_time, 2)
        _finalize_pr_scan_metrics(scan, eval_result, findings_data, duration=duration)

        # 4. Save and reconcile findings in database:
        _reconcile_pr_findings_in_db(db, repository_id, scan.id, pull_number, findings_data)

        repo.last_scanned_at = datetime.datetime.now(datetime.timezone.utc)
        repo.last_scan_status = scan.scan_result
        db.commit()
        logger.info(
            "PR #%s scan for repo %s finished in %ss with %s findings",
            pull_number,
            repo.full_name,
            duration,
            len(findings_data),
        )

        # 5. Send results to GitHub: PR Comment & GitHub Check Run
        if inst_id:
            # 5a. Post/update GitHub Pull Request comment
            trigger_pr_comment(
                installation_id=inst_id,
                owner=owner,
                repo=repo_name,
                pull_number=pull_number,
                findings=findings_data,
                result=eval_result,
                base_branch=base_branch,
            )

            # 5b. Create GitHub Check Run with annotations
            trigger_check_run(
                installation_id=inst_id,
                owner=owner,
                repo=repo_name,
                head_sha=commit_sha,
                status="completed",
                findings=findings_data,
                result=eval_result,
            )

    except Exception as exc:
        logger.exception("PR scan on #%s failed unexpectedly: %s", pull_number, exc)
        scan.scan_status = "failed"
        scan.scan_result = "error"
        scan.scan_duration = round(time.time() - start_time, 2)
        db.commit()

    finally:
        db.close()


def record_pr_scan_results(
    repository_name: str,
    pull_number: int,
    commit_sha: str = "HEAD",
    branch: str = "main",
    base_branch: str = "main",
    pr_title: Optional[str] = None,
    pr_author: Optional[str] = None,
    pr_html_url: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    findings: Optional[List[Dict[str, Any]]] = None,
    check_run_id: Optional[int] = None,
    installation_id: Optional[int] = None,
    pr_state: Optional[str] = "open",
    pr_merged_at: Optional[datetime.datetime] = None,
    pr_closed_at: Optional[datetime.datetime] = None,
) -> Optional[str]:
    """
    Persist PR scan results from GitHub App webhook into the Secura database.
    Finds or registers the repository, creates/updates a Scan record, and inserts Findings.
    """
    db: Session = SessionLocal()
    try:
        repo = (
            db.query(Repository)
            .filter(
                (func.lower(Repository.full_name) == repository_name.lower())
                | (Repository.name == repository_name.split("/")[-1])
            )
            .first()
        )
        if not repo:
            from app.models.installation import GitHubInstallation
            from app.models.user import User
            owner, r_name = repository_name.split("/", 1) if "/" in repository_name else ("", repository_name)
            inst = None
            if installation_id:
                inst = db.query(GitHubInstallation).filter(GitHubInstallation.github_installation_id == installation_id).first()
            if not inst and owner:
                inst = db.query(GitHubInstallation).filter(func.lower(GitHubInstallation.account_name) == owner.lower()).first()

            user = None
            if inst and inst.user_id:
                user = db.query(User).filter(User.id == inst.user_id).first()
            if not user and owner:
                user = db.query(User).filter(func.lower(User.github_username) == owner.lower()).first()

            if user:
                repo = Repository(
                    name=r_name,
                    full_name=repository_name,
                    owner=owner,
                    default_branch=base_branch or "main",
                    is_private=False,
                    is_monitored=True,
                    html_url=f"https://github.com/{repository_name}",
                    user_id=user.id,
                    installation_id=inst.id if inst else None,
                )
                db.add(repo)
                db.commit()
                db.refresh(repo)

        if not repo:
            logger.warning("No user found to associate repository %s", repository_name)
            return None

        findings_data = findings or []
        eval_result = result or {}

        scan = _get_or_create_pr_scan(
            db=db,
            repository_id=repo.id,
            pull_number=pull_number,
            commit_sha=commit_sha,
            branch=branch,
            base_branch=base_branch,
            pr_title=pr_title,
            pr_author=pr_author,
            pr_html_url=pr_html_url,
            pr_state=pr_state,
            pr_merged_at=pr_merged_at,
            pr_closed_at=pr_closed_at,
            default_owner=repo.owner,
            default_repo_name=repo.name,
        )

        _finalize_pr_scan_metrics(
            scan=scan,
            eval_result=eval_result,
            findings_data=findings_data,
            check_run_id=check_run_id,
        )

        _reconcile_pr_findings_in_db(
            db=db,
            repo_id=repo.id,
            scan_id=scan.id,
            pull_number=pull_number,
            findings_data=findings_data,
        )

        # Update repository stats
        repo.last_scanned_at = datetime.datetime.now(datetime.timezone.utc)
        repo.last_scan_status = scan.scan_result

        db.commit()
        logger.info("Persisted PR #%s scan for repo %s to database (findings: %s)", pull_number, repository_name, len(findings_data))
        return scan.id
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to persist PR scan for %s to database: %s", repository_name, exc)
        return None
    finally:
        db.close()


def _resolve_removed_files(db: Session, repo_id: str, removed_files: Iterable[str]) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    for filename in removed_files:
        db.query(Finding).filter(
            Finding.repository_id == repo_id,
            Finding.file_path == filename,
            Finding.status == "open",
        ).update(
            {Finding.status: "resolved", Finding.last_detected: now},
            synchronize_session=False,
        )


def _scan_and_resolve_files(
    db: Session,
    repo_id: str,
    token: Optional[str],
    owner: str,
    repo_name: str,
    ref_sha: str,
    filenames: Iterable[str],
) -> List[Dict[str, Any]]:
    findings_data: List[Dict[str, Any]] = []
    if not token:
        return findings_data

    now = datetime.datetime.now(datetime.timezone.utc)
    for filename in filenames:
        if not is_scannable_file(filename):
            continue
        try:
            content = get_repository_file_content(token, owner, repo_name, filename, ref_sha)
            if content:
                sec_results = scan_secrets_content(content, file_path=filename)
                file_sast = scan_sast_content(content, file_path=filename)
                file_findings = sec_results + file_sast

                if file_findings:
                    findings_data.extend(file_findings)
                else:
                    db.query(Finding).filter(
                        Finding.repository_id == repo_id,
                        Finding.file_path == filename,
                        Finding.status == "open",
                    ).update(
                        {Finding.status: "resolved", Finding.last_detected: now},
                        synchronize_session=False,
                    )
        except Exception as content_err:
            logger.warning("Could not read file %s: %s", filename, content_err)

    return findings_data


def _record_branch_scan_completion(
    db: Session,
    scan: Scan,
    repo: Repository,
    findings_data: List[Dict[str, Any]],
    start_time: float,
    default_recommendation: str,
) -> float:
    policy = load_policy()
    eval_result = evaluate_policy(findings_data, policy)
    duration = round(time.time() - start_time, 2)
    _finalize_pr_scan_metrics(scan, eval_result, findings_data, duration=duration)
    if findings_data:
        persist_scan_findings(
            db,
            scan.id,
            repo.id,
            findings_data,
            default_recommendation=default_recommendation,
        )
    repo.last_scanned_at = datetime.datetime.now(datetime.timezone.utc)
    repo.last_scan_status = scan.scan_result
    db.commit()
    return duration


def _publish_main_branch_check_run(
    inst_id: Optional[int],
    owner: str,
    repo_name: str,
    ref_sha: str,
    findings_data: List[Dict[str, Any]],
    event_label: str = "main",
) -> None:
    """Create GitHub Check Run for merge or push commit on default/main branch."""
    if not (inst_id and ref_sha and ref_sha != "HEAD"):
        return
    try:
        counts = {
            "CRITICAL": sum(1 for f in findings_data if f.get("severity") == "CRITICAL"),
            "HIGH": sum(1 for f in findings_data if f.get("severity") == "HIGH"),
            "MEDIUM": sum(1 for f in findings_data if f.get("severity") == "MEDIUM"),
            "LOW": sum(1 for f in findings_data if f.get("severity") == "LOW"),
        }
        result_dict = {
            "passed": len(findings_data) == 0,
            "score": 100 if len(findings_data) == 0 else 0,
            "counts": counts,
            "failures": ["Unsafe commit on main: security findings detected"] if findings_data else [],
        }
        trigger_check_run(
            installation_id=inst_id,
            owner=owner,
            repo=repo_name,
            head_sha=ref_sha,
            status="completed",
            findings=findings_data,
            result=result_dict,
        )
    except Exception as cr_err:
        logger.warning("Could not post check run for %s: %s", event_label, cr_err)


def execute_main_merge_scan(
    repository_id: str,
    pull_number: int,
    merge_commit_sha: str = "HEAD",
    head_sha: str = "HEAD",
    base_branch: str = "main",
    installation_id: Optional[int] = None,
):
    """
    Dedicated worker triggered when a Pull Request is merged into the default branch (e.g. main):
    1. Fetches files changed in the merged PR from GitHub.
    2. Deep scans each scannable file at the merge_commit_sha on the main branch.
    3. If findings are detected:
       - Deletes old findings on main for those files and saves the new findings for main.
       - In the website's findings section, they are visible.
    4. If no findings are detected in those files:
       - Deletes any old findings on main for those files (resolving them on main!).
    5. Cleans up the PR-level findings so they do not duplicate.
    6. Creates/updates a main branch Scan record.
    """
    db: Session = SessionLocal()
    start_time = time.time()
    try:
        repo, token, owner, repo_name, inst_id = _get_repo_token_and_names(db, repository_id, installation_id)
        if not repo:
            return
        ref_sha = merge_commit_sha if merge_commit_sha and merge_commit_sha != "HEAD" else head_sha

        short_sha = ref_sha[:12] if ref_sha else "HEAD"
        target_branch = base_branch or repo.default_branch or "main"
        scan = Scan(
            repository_id=repo.id,
            commit_sha=short_sha,
            branch=target_branch,
            scan_status="running",
            score=100,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)

        findings_data: List[Dict[str, Any]] = []

        if token:
            try:
                pr_files = get_pull_request_files(token, owner, repo_name, pull_number)
                removed_files = [
                    f.get("filename") for f in pr_files
                    if f.get("filename") and f.get("status") == "removed"
                ]
                _resolve_removed_files(db, repo.id, removed_files)
                scannable_files = [
                    f.get("filename") for f in pr_files
                    if f.get("filename") and f.get("status") != "removed"
                ]
                findings_data = _scan_and_resolve_files(
                    db, repo.id, token, owner, repo_name, ref_sha, scannable_files
                )
            except Exception as gh_err:
                logger.warning("Error fetching merged PR files: %s", gh_err)

        # Mark any remaining open findings for this merged PR as resolved
        pr_scans = db.query(Scan).filter(Scan.repository_id == repo.id, Scan.pull_number == pull_number).all()
        pr_scan_ids = [s.id for s in pr_scans]
        if pr_scan_ids and not findings_data:
            db.query(Finding).filter(
                Finding.scan_id.in_(pr_scan_ids),
                Finding.status == "open",
            ).update(
                {Finding.status: "resolved", Finding.last_detected: datetime.datetime.now(datetime.timezone.utc)},
                synchronize_session=False,
            )

        duration = _record_branch_scan_completion(
            db, scan, repo, findings_data, start_time,
            default_recommendation="Review and remediate security vulnerability on main branch.",
        )
        logger.info("Merged PR #%s main branch scan finished in %ss with %s findings", pull_number, duration, len(findings_data))
        _publish_main_branch_check_run(inst_id, owner, repo_name, ref_sha, findings_data, event_label="main merge")
    except Exception as exc:
        db.rollback()
        logger.exception("execute_main_merge_scan failed: %s", exc)
    finally:
        db.close()


def execute_main_push_scan(
    repository_id: str,
    commit_sha: str,
    commits: List[Dict[str, Any]],
    head_commit: Optional[Dict[str, Any]] = None,
    branch: str = "main",
    installation_id: Optional[int] = None,
):
    """
    Dedicated worker triggered on direct push or merge commit to main branch.
    Scans added/modified files at commit_sha, resolves findings on modified/removed files,
    and updates findings on main.
    """
    db: Session = SessionLocal()
    start_time = time.time()
    try:
        repo, token, owner, repo_name, inst_id = _get_repo_token_and_names(db, repository_id, installation_id)
        if not repo:
            return
        ref_sha = commit_sha or "HEAD"

        short_sha = ref_sha[:12] if ref_sha else "HEAD"
        scan = Scan(
            repository_id=repo.id,
            commit_sha=short_sha,
            branch=branch,
            scan_status="running",
            score=100,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)

        added_or_modified = set()
        removed = set()

        all_commits = list(commits or [])
        if head_commit:
            all_commits.append(head_commit)

        for c in all_commits:
            for f in c.get("added", []):
                added_or_modified.add(f)
            for f in c.get("modified", []):
                added_or_modified.add(f)
            for f in c.get("removed", []):
                removed.add(f)
                added_or_modified.discard(f)

        _resolve_removed_files(db, repo.id, removed)
        findings_data = _scan_and_resolve_files(
            db, repo.id, token, owner, repo_name, ref_sha, added_or_modified
        )

        duration = _record_branch_scan_completion(
            db, scan, repo, findings_data, start_time,
            default_recommendation="Remediate security finding on main branch.",
        )
        logger.info("Main branch push scan completed in %ss with %s findings", duration, len(findings_data))
        _publish_main_branch_check_run(inst_id, owner, repo_name, ref_sha, findings_data, event_label="main push")
    except Exception as exc:
        db.rollback()
        logger.exception("execute_main_push_scan failed: %s", exc)
    finally:
        db.close()



