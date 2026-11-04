import datetime
import json
import logging
import time
from typing import Any, Dict, List, Optional
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
)
from secura.secrets import scan_content as scan_secrets_content
from secura.sast import scan_content as scan_sast_content
from secura.pr_changes import is_scannable_file
from secura.policy import evaluate_policy, load_policy

logger = logging.getLogger("secura.scan_runner")


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
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            logger.error("Repository %s not found for scan %s", repository_id, scan.id)
            scan.scan_status = "failed"
            scan.scan_result = "error"
            db.commit()
            return

        # If a local checkout path is provided, scan it; otherwise scan the workspace
        target_dir = directory_to_scan or "."
        scan_output = run_full_scan(target_dir)

        result = scan_output["result"]
        findings_data = scan_output["findings"]

        duration = round(time.time() - start_time, 2)
        counts = result.get("counts", {})

        scan.scan_status = "completed"
        scan.scan_result = "passed" if result.get("passed", True) else "failed"
        scan.score = result.get("score", 100)
        scan.total_findings = len(findings_data)
        scan.critical_count = counts.get("CRITICAL", 0)
        scan.high_count = counts.get("HIGH", 0)
        scan.medium_count = counts.get("MEDIUM", 0)
        scan.low_count = counts.get("LOW", 0)
        scan.scan_duration = duration
        scan.completed_at = datetime.datetime.now(datetime.timezone.utc)

        # Save findings
        for item in findings_data:
            f_type = item.get("type", "Unknown")
            rule_id = map_type_to_rule_id(f_type)
            f_path = str(item.get("file", ""))
            line_no = int(item.get("line", 1))
            sev = str(item.get("severity", "MEDIUM")).upper()

            fingerprint = compute_finding_fingerprint(repository_id, rule_id, f_path, line_no)

            # Check if this finding was already detected before
            existing_finding = (
                db.query(Finding)
                .filter(
                    Finding.repository_id == repository_id,
                    Finding.fingerprint == fingerprint,
                )
                .first()
            )

            now = datetime.datetime.now(datetime.timezone.utc)
            first_seen = existing_finding.first_detected if existing_finding else now

            finding_record = Finding(
                scan_id=scan.id,
                repository_id=repository_id,
                rule_id=rule_id,
                finding_type=f_type,
                severity=sev,
                file_path=f_path,
                line_number=line_no,
                fingerprint=fingerprint,
                status="open",
                risk=item.get("risk"),
                recommendation=item.get("recommendation"),
                first_detected=first_seen,
                last_detected=now,
            )
            db.add(finding_record)

        db.commit()
        logger.info(
            "Scan %s for repo %s completed in %ss with %s findings",
            scan.id,
            repo.full_name,
            duration,
            len(findings_data),
        )

        # Update GitHub Check Run if installation ID is present
        inst_id = installation_id or (repo.installation.github_installation_id if repo.installation else None)
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

    scan = Scan(
        repository_id=repository_id,
        commit_sha=commit_sha[:12] if commit_sha else "HEAD",
        branch=branch,
        base_branch=base_branch,
        pull_number=pull_number,
        pr_title=pr_title or f"Pull Request #{pull_number}",
        pr_author=pr_author,
        pr_html_url=pr_html_url,
        pr_state=pr_state or "open",
        pr_merged_at=pr_merged_at,
        pr_closed_at=pr_closed_at,
        scan_status="running",
        score=100,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

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

        # Store PR commits if not already recorded
        if not scan.pr_commits_json:
            try:
                from app.services.github_service import get_pull_request_commits
                raw_commits = get_pull_request_commits(inst_id, owner, repo_name, pull_number)
                if not raw_commits:
                    short_sha = commit_sha[:7] if len(commit_sha) >= 7 else commit_sha
                    raw_commits = [
                        {
                            "sha": short_sha,
                            "full_sha": commit_sha,
                            "message": pr_title or f"Commit {short_sha} for PR #{pull_number}",
                            "author": pr_author or repo.owner,
                            "author_avatar": None,
                            "date": datetime.datetime.utcnow().isoformat(),
                            "html_url": pr_html_url or f"https://github.com/{repo.full_name}/commit/{commit_sha}",
                        }
                    ]
                scan.pr_commits_json = json.dumps(raw_commits)
                db.commit()
            except Exception:
                pass

        findings_data: List[Dict[str, Any]] = []

        # 1. Fetch files changed in the PR from GitHub
        token = None
        if inst_id:
            try:
                token = create_installation_token(inst_id)
            except Exception as token_err:
                logger.warning("Could not obtain installation token for %s: %s", inst_id, token_err)

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
                    content = get_repository_file_content(token, owner, repo_name, filename, commit_sha)
                    if content:
                        sec_findings = scan_secrets_content(content, file_path=filename)
                        findings_data.extend(sec_findings)

                        sast_findings = scan_sast_content(content, file_path=filename)
                        findings_data.extend(sast_findings)
                except Exception as content_err:
                    logger.warning("Could not fetch PR file content for %s: %s", filename, content_err)
        except Exception as gh_err:
            logger.warning("GitHub API PR fetch failed: %s. Falling back to local diff scan.", gh_err)

        # 2. Fallback to local scan if no remote files were found (e.g. offline dev testing)
        if not findings_data:
            from secura.scanner import scan_changed_files
            try:
                findings_data = scan_changed_files(".", base_ref=base_branch)
            except Exception:
                pass

        # 3. Evaluate findings with security policy
        policy = load_policy()
        eval_result = evaluate_policy(findings_data, policy)
        counts = eval_result.get("counts", {})
        duration = round(time.time() - start_time, 2)

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
        scan.scan_duration = duration
        scan.completed_at = datetime.datetime.now(datetime.timezone.utc)

        # 4. Save findings to database
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

            now = datetime.datetime.now(datetime.timezone.utc)
            first_seen = existing_finding.first_detected if existing_finding else now

            finding_record = Finding(
                scan_id=scan.id,
                repository_id=repository_id,
                rule_id=rule_id,
                finding_type=f_type,
                severity=sev,
                file_path=f_path,
                line_number=line_no,
                fingerprint=fingerprint,
                status="open",
                risk=item.get("risk"),
                recommendation=item.get("recommendation") or "Remove credential or secret from pull request.",
                first_detected=first_seen,
                last_detected=now,
            )
            db.add(finding_record)

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
        repo = db.query(Repository).filter(Repository.full_name == repository_name).first()
        if not repo:
            from app.models.installation import GitHubInstallation
            from app.models.user import User
            inst = None
            if installation_id:
                inst = db.query(GitHubInstallation).filter(GitHubInstallation.github_installation_id == installation_id).first()
            if not inst:
                inst = db.query(GitHubInstallation).first()

            user = None
            if inst:
                user = db.query(User).filter(User.id == inst.user_id).first()
            if not user:
                user = db.query(User).first()

            if user:
                owner, r_name = repository_name.split("/", 1) if "/" in repository_name else ("", repository_name)
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
        counts = eval_result.get("counts", {})

        short_sha = commit_sha[:12] if commit_sha else "HEAD"
        scan = (
            db.query(Scan)
            .filter(
                Scan.repository_id == repo.id,
                Scan.pull_number == pull_number,
                Scan.commit_sha == short_sha,
            )
            .first()
        )
        if not scan:
            scan = Scan(
                repository_id=repo.id,
                commit_sha=short_sha,
                branch=branch,
                base_branch=base_branch,
                pull_number=pull_number,
                pr_title=pr_title or f"Pull Request #{pull_number}",
                pr_author=pr_author or repo.owner,
                pr_html_url=pr_html_url or f"https://github.com/{repository_name}/pull/{pull_number}",
                pr_state=pr_state or "open",
                pr_merged_at=pr_merged_at,
                pr_closed_at=pr_closed_at,
            )
            db.add(scan)
            db.commit()
            db.refresh(scan)
        else:
            scan.branch = branch
            scan.base_branch = base_branch
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
        if check_run_id:
            scan.check_run_id = check_run_id
        scan.completed_at = datetime.datetime.now(datetime.timezone.utc)

        # Delete previous findings for this scan run to prevent duplicates on synchronize
        db.query(Finding).filter(Finding.scan_id == scan.id).delete()

        # Save findings
        for item in findings_data:
            f_type = item.get("type", "Unknown")
            rule_id = map_type_to_rule_id(f_type)
            f_path = str(item.get("file", ""))
            line_no = int(item.get("line", 1))
            sev = str(item.get("severity", "MEDIUM")).upper()

            fingerprint = compute_finding_fingerprint(repo.id, rule_id, f_path, line_no)

            existing_finding = (
                db.query(Finding)
                .filter(
                    Finding.repository_id == repo.id,
                    Finding.fingerprint == fingerprint,
                )
                .first()
            )

            now = datetime.datetime.now(datetime.timezone.utc)
            first_seen = existing_finding.first_detected if existing_finding else now

            finding_record = Finding(
                scan_id=scan.id,
                repository_id=repo.id,
                rule_id=rule_id,
                finding_type=f_type,
                severity=sev,
                file_path=f_path,
                line_number=line_no,
                fingerprint=fingerprint,
                status="open",
                risk=item.get("risk"),
                recommendation=item.get("recommendation") or "Remove credential or secret from pull request.",
                first_detected=first_seen,
                last_detected=now,
            )
            db.add(finding_record)

        # Update repository stats
        repo.last_scanned_at = datetime.datetime.now(datetime.timezone.utc)
        repo.last_scan_status = scan.scan_result
        repo.open_findings = len(findings_data)
        repo.critical_findings = counts.get("CRITICAL", 0)
        repo.high_findings = counts.get("HIGH", 0)

        db.commit()
        logger.info("Persisted PR #%s scan for repo %s to database (findings: %s)", pull_number, repository_name, len(findings_data))
        return scan.id
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to persist PR scan for %s to database: %s", repository_name, exc)
        return None
    finally:
        db.close()


