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
        title = "Secura Security Gate: FAILED - Unsafe to merge"

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
        title = "Secura Security Gate: PASSED - Safe to merge"
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
        built_conclusion, built_title, built_summary, annotations = build_check_output(
            findings=findings,
            result=result,
        )

        final_conclusion = conclusion or built_conclusion
        final_title = title or built_title
        final_summary = summary or built_summary

        if final_conclusion not in ALLOWED_CONCLUSIONS:
            raise ValueError(
                f"Invalid Check Run conclusion: {final_conclusion}"
            )

        output_payload = {
            "title": final_title,
            "summary": final_summary,
        }
        if annotations:
            output_payload["annotations"] = annotations

        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": final_conclusion,
            "output": output_payload,
        }

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
    findings: list[dict] | None = None,
    result: dict | None = None,
    conclusion: str | None = None,
    title: str | None = None,
    summary: str | None = None,
) -> dict:
    """
    Update an existing GitHub Check Run with completed scan results.
    """
    built_conclusion, built_title, built_summary, annotations = build_check_output(
        findings=findings,
        result=result,
    )

    final_conclusion = conclusion or built_conclusion
    final_title = title or built_title
    final_summary = summary or built_summary

    if final_conclusion not in ALLOWED_CONCLUSIONS:
        raise ValueError(
            f"Invalid Check Run conclusion: {final_conclusion}"
        )

    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/check-runs/{check_run_id}"

    output_payload = {
        "title": final_title,
        "summary": final_summary,
    }

    if annotations:
        output_payload["annotations"] = annotations

    response = requests.patch(
        url,
        headers={
            "Authorization": f"Bearer {installation_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={
            "status": "completed",
            "conclusion": final_conclusion,
            "output": output_payload,
        },
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
