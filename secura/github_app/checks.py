import logging
import requests


logger = logging.getLogger("secura.github_app.checks")

GITHUB_API_URL = "https://api.github.com"

ALLOWED_CONCLUSIONS = {
    "success",
    "failure",
    "neutral",
    "cancelled",
    "timed_out",
    "action_required",
    "skipped",
}

MAX_ANNOTATIONS = 50


def annotation_level(severity: str) -> str:
    """Map Secura severity to GitHub Check Run annotation level."""
    sev = str(severity).upper()
    if sev in {"CRITICAL", "HIGH"}:
        return "failure"
    if sev == "MEDIUM":
        return "warning"
    return "notice"


def build_check_output(
    findings: list[dict] | None = None,
    result: dict | None = None,
) -> tuple[str, str, str, list[dict]]:
    """
    Build Check Run conclusion, title, markdown summary, and annotations
    from findings and evaluation result.
    """
    findings = findings or []
    result = result or {}

    passed = result.get("passed", len(findings) == 0)
    score = result.get("score", 100 if passed else 0)
    counts = result.get("counts", {
        "CRITICAL": sum(1 for f in findings if f.get("severity") == "CRITICAL"),
        "HIGH": sum(1 for f in findings if f.get("severity") == "HIGH"),
        "MEDIUM": sum(1 for f in findings if f.get("severity") == "MEDIUM"),
        "LOW": sum(1 for f in findings if f.get("severity") == "LOW"),
    })
    failures = result.get("failures", [])

    has_violations = (
        not passed
        or counts["CRITICAL"] > 0
        or counts["HIGH"] > 0
        or len(failures) > 0
    )

    if has_violations or findings:
        conclusion = "failure"
        title = f"Failed - {len(findings)} security finding(s) detected (Score: {score}/100)"

        summary_lines = [
            "## ❌ MERGE BLOCKED: Unsafe to merge into main\n",
            f"Secura detected **{len(findings)} security finding(s)**. "
            "Merging this pull request into `main` is **blocked** to prevent "
            "exposed credentials or vulnerabilities from reaching production.\n",
            "### Security Score",
            f"- **Score:** `{score}/100`",
            f"- **Critical:** `{counts['CRITICAL']}`",
            f"- **High:** `{counts['HIGH']}`",
            f"- **Medium:** `{counts['MEDIUM']}`",
            f"- **Low:** `{counts['LOW']}`\n",
        ]

        if failures:
            summary_lines.append("### Policy Violations")
            for failure in failures:
                summary_lines.append(f"- ⚠️ {failure}")
            summary_lines.append("")

        if findings:
            summary_lines.append("### Detected Findings")
            for idx, finding in enumerate(findings[:30], start=1):
                f_type = finding.get("type", "Security Finding")
                f_file = finding.get("file", "unknown")
                f_line = finding.get("line", "?")
                f_sev = finding.get("severity", "HIGH")
                rec = finding.get("recommendation")

                entry = f"{idx}. **[{f_sev}] {f_type}** in `{f_file}:{f_line}`"
                if rec:
                    entry += f"\n   - *Recommendation:* {rec}"
                summary_lines.append(entry)

            if len(findings) > 30:
                summary_lines.append(
                    f"\n*...and {len(findings) - 30} additional finding(s).*"
                )

        summary = "\n".join(summary_lines)

    else:
        conclusion = "success"
        title = f"Passed - 0 secrets detected (Score: {score}/100)"
        summary = (
            "## ✅ Secura Security Gate: PASSED\n\n"
            "Secura scanned all changed files and detected no exposed secrets "
            "or security policy violations.\n\n"
            "This pull request is safe to merge into `main`."
        )

    # Build annotations for PR diff
    annotations = []
    for finding in findings[:MAX_ANNOTATIONS]:
        f_file = str(finding.get("file", "")).replace("\\", "/")
        line = finding.get("line", 1)

        if not f_file or not isinstance(line, int) or line < 1:
            continue

        f_type = finding.get("type", "Security Finding")
        f_sev = finding.get("severity", "HIGH")
        msg = f"{f_sev}: {f_type}"
        if finding.get("recommendation"):
            msg += f"\nRemediation: {finding['recommendation']}"

        annotations.append({
            "path": f_file,
            "start_line": line,
            "end_line": line,
            "annotation_level": annotation_level(f_sev),
            "title": f_type,
            "message": msg,
        })

    return conclusion, title, summary, annotations


def _prepare_completed_check_output(
    findings: list[dict] | None,
    result: dict | None,
    conclusion: str | None,
    title: str | None,
    summary: str | None,
) -> tuple[str, dict]:
    """Assemble standardized conclusion and output dictionary for completed check runs."""
    b_conclusion, b_title, b_summary, annotations = build_check_output(findings=findings, result=result)
    fin_conclusion = conclusion or b_conclusion
    if fin_conclusion not in ALLOWED_CONCLUSIONS:
        raise ValueError(f"Invalid Check Run conclusion: {fin_conclusion}")

    out: dict = {
        "title": title or b_title,
        "summary": summary or b_summary,
    }
    if annotations:
        out["annotations"] = annotations
    return fin_conclusion, out


def create_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    head_sha: str,
    status: str = "completed",
    findings: list[dict] | None = None,
    result: dict | None = None,
    conclusion: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    name: str = "Secura Security Gate",
    details_url: str | None = None,
) -> dict:
    """
    Create a GitHub Check Run for a Secura security scan.
    """
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/check-runs"

    if status == "in_progress":
        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "in_progress",
            "output": {
                "title": "Secura Security Scan in progress",
                "summary": "Secura is currently scanning changed files for secrets and security policy violations.",
            },
        }
    else:
        final_conclusion, output_payload = _prepare_completed_check_output(
            findings, result, conclusion, title, summary
        )
        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": final_conclusion,
            "output": output_payload,
        }

    if details_url:
        payload["details_url"] = details_url

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {installation_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json=payload,
        timeout=15,
    )

    if not response.ok:
        logger.error(
            "GitHub Check Run creation error. Status: %s, Response: %s",
            response.status_code,
            response.text,
        )

    response.raise_for_status()
    check_run = response.json()

    logger.info(
        "Created Check Run: %s (ID: %s, Status: %s, Conclusion: %s)",
        check_run.get("name"),
        check_run.get("id"),
        check_run.get("status"),
        check_run.get("conclusion"),
    )

    return check_run


def update_check_run(
    installation_token: str,
    owner: str,
    repo: str,
    check_run_id: int,
    status: str = "completed",
    findings: list[dict] | None = None,
    result: dict | None = None,
    conclusion: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    details_url: str | None = None,
) -> dict:
    """
    Update an existing GitHub Check Run with completed scan results.
    """
    final_conclusion, output_payload = _prepare_completed_check_output(
        findings, result, conclusion, title, summary
    )

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/check-runs/{check_run_id}"

    patch_payload = {
        "status": status,
        "conclusion": final_conclusion,
        "output": output_payload,
    }
    if details_url:
        patch_payload["details_url"] = details_url

    response = requests.patch(
        url,
        headers={
            "Authorization": f"Bearer {installation_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json=patch_payload,
        timeout=15,
    )

    if not response.ok:
        logger.error(
            "GitHub Check Run modification failed. Status: %s, Response: %s",
            response.status_code,
            response.text,
        )

    response.raise_for_status()
    check_run = response.json()

    logger.info(
        "Updated Check Run: %s (ID: %s, Conclusion: %s)",
        check_run.get("name"),
        check_run.get("id"),
        check_run.get("conclusion"),
    )

    return check_run


def post_pull_request_comment(
    installation_token: str,
    owner: str,
    repo: str,
    pull_number: int,
    findings: list[dict] | None = None,
    result: dict | None = None,
    base_branch: str = "main",
) -> dict | None:
    """
    Post or update an informative security gate comment on a GitHub Pull Request.
    Uses an invisible marker <!-- secura-security-gate --> to update previous comments
    and avoid spamming PR conversation timelines with duplicate comments.
    """
    findings = findings or []
    result = result or {}

    passed = result.get("passed", len(findings) == 0)
    score = result.get("score", 100 if passed else 0)

    marker = "<!-- secura-security-gate -->"

    if not passed or findings:
        table_rows = []
        for idx, f in enumerate(findings[:30], start=1):
            sev = f.get("severity", "HIGH")
            ftype = f.get("type", "Secret Finding")
            fpath = str(f.get("file", "unknown")).replace("\\", "/")
            line = f.get("line", "?")
            rec = f.get("recommendation") or "Remove credential and store in GitHub Secrets or .env."
            table_rows.append(
                f"| `{idx}` | **{sev}** | {ftype} | `{fpath}:{line}` | {rec} |"
            )

        more_note = f"\n\n*...and {len(findings) - 30} additional finding(s).*" if len(findings) > 30 else ""

        body = (
            f"{marker}\n"
            f"## 🚨 Secura Security Gate: FAILED — Unsafe to Merge\n\n"
            f"Secura scanned the files in this pull request and detected **{len(findings)} security finding(s)**. "
            f"Merging into `{base_branch}` is **blocked** to prevent credential leakage and security vulnerabilities.\n\n"
            f"### ⚠️ Detected Findings & Exposed Secrets\n"
            f"| # | Severity | Finding Type | File & Line | Recommendation |\n"
            f"| :-: | :--- | :--- | :--- | :--- |\n"
            + "\n".join(table_rows)
            + more_note
            + f"\n\n**Security Score:** `{score}/100`\n\n"
            f"---\n"
            f"🔒 **Action Required:** Remove or revoke these exposed credentials before merging this pull request into `{base_branch}`.\n"
            f"*Secura Security Scanner — Automated Pull Request Protection*"
        )
    else:
        body = (
            f"{marker}\n"
            f"## ✅ Secura Security Gate: PASSED\n\n"
            f"Secura scanned all changed files in this pull request and found **no secrets or security policy violations**.\n\n"
            f"- **Secrets Detected:** `0`\n"
            f"- **Policy Violations:** `0`\n"
            f"- **Security Score:** `100/100`\n\n"
            f"✅ **Safe to Merge:** This pull request satisfies all security policies for `{base_branch}`.\n\n"
            f"*Secura Security Scanner — Automated Pull Request Protection*"
        )

    headers = {
        "Authorization": f"Bearer {installation_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        # Check existing comments to update instead of creating duplicate
        list_url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/issues/{pull_number}/comments"
        list_res = requests.get(list_url, headers=headers, params={"per_page": 50}, timeout=15)
        existing_comment_id = None

        if list_res.ok:
            for comment in list_res.json():
                comment_body = comment.get("body", "")
                if marker in comment_body or "## 🚨 Secura Security Gate" in comment_body or "## ✅ Secura Security Gate" in comment_body:
                    existing_comment_id = comment.get("id")
                    break

        if existing_comment_id:
            patch_url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/issues/comments/{existing_comment_id}"
            patch_res = requests.patch(patch_url, headers=headers, json={"body": body}, timeout=15)
            if patch_res.ok:
                logger.info("Updated existing Secura comment on PR #%s", pull_number)
                return patch_res.json()

        post_res = requests.post(list_url, headers=headers, json={"body": body}, timeout=15)
        if post_res.ok:
            logger.info("Created Secura comment on PR #%s", pull_number)
            return post_res.json()
        else:
            logger.warning("Failed to post comment to PR #%s: %s", pull_number, post_res.text)
            return None
    except Exception as exc:
        logger.error("Exception posting PR comment to #%s: %s", pull_number, exc)
        return None

