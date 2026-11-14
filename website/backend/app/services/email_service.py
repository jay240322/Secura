import logging
import datetime
from typing import Optional
import httpx
from fastapi import BackgroundTasks

from app.core.config import settings

logger = logging.getLogger("secura.email")

RESEND_API_URL = "https://api.resend.com/emails"


def _is_deliverable_email(email: str) -> bool:
    """Validate if the email is a real deliverable address and not a noreply placeholder."""
    if not email or "@" not in email:
        return False
    email_lower = email.strip().lower()
    if "@users.noreply.github.com" in email_lower:
        return False
    if "noreply" in email_lower and "github" in email_lower:
        return False
    return True


def _wrap_email_layout(title: str, banner_html: str, body_html: str) -> str:
    """Shared responsive dark-theme container for all Secura transactional emails."""
    year = datetime.datetime.now().year
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1117; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #181920; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          {banner_html}
          <tr>
            <td style="padding: 28px 32px 24px;">
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="background-color: #121318; padding: 24px 32px; border-top: 1px solid #27272a; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #71717a;">
                © {year} Secura Inc. Zero Code Retention Guaranteed.
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                Autonomous secret scanning and merge gate protection for GitHub.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _generate_welcome_html(user_name: str, dashboard_url: str) -> str:
    """Generate HTML template for welcome email upon registration."""
    banner = """
    <tr>
      <td style="background: linear-gradient(135deg, #281C59 0%, #5227FF 50%, #7C3AED 100%); padding: 36px 32px; text-align: center;">
        <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 10px; margin-bottom: 12px; backdrop-filter: blur(8px);">
          <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🛡️ Secura</span>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Secura Security!</h1>
        <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Next-Gen Autonomous Code & Repository Security</p>
      </td>
    </tr>
    """
    body = f"""
      <p style="font-size: 16px; line-height: 24px; color: #f4f4f5; margin: 0 0 16px;">
        Hi <strong>{user_name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 20px;">
        Thank you for joining Secura. Your account is verified and ready to protect your GitHub repositories from credential leaks and risky PR merges.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #d4d4d8;">
            ⚡ <strong>Zero Code Retention:</strong> Diffs analyzed ephemerally in-memory.
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #d4d4d8;">
            🔑 <strong>100+ Signatures:</strong> Immediate detection for AWS, Stripe, Slack, etc.
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #d4d4d8;">
            🛡️ <strong>GitHub Merge Gates:</strong> Automate branch protection via Check Runs.
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin: 32px 0 24px;">
        <a href="{dashboard_url}" style="display: inline-block; background: linear-gradient(135deg, #00285B 0%, #1e40af 100%); color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 40, 91, 0.4);">
          Open Secura Dashboard →
        </a>
      </div>
    """
    return _wrap_email_layout("Welcome to Secura", banner, body)


def _generate_login_html(user_name: str, provider: str, timestamp_str: str, dashboard_url: str) -> str:
    """Generate HTML template for login notification email."""
    banner = """
    <tr>
      <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 32px; border-bottom: 1px solid #3730a3; text-align: center;">
        <div style="display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; padding: 10px; margin-bottom: 10px;">
          <span style="font-size: 26px;">🛡️</span>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Sign-In Detected</h1>
        <p style="color: #c7d2fe; margin: 6px 0 0; font-size: 13px;">Security Notice for Secura Account</p>
      </td>
    </tr>
    """
    body = f"""
      <p style="font-size: 15px; line-height: 22px; color: #f4f4f5; margin: 0 0 16px;">
        Hello <strong>{user_name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 20px;">
        We detected a successful sign-in to your Secura Security account.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #20222b; border: 1px solid #2e303b; border-radius: 12px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #a1a1aa;">
              <strong style="color: #e4e4e7;">Sign-In Method:</strong> {provider.upper()}
            </p>
            <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
              <strong style="color: #e4e4e7;">Timestamp:</strong> {timestamp_str} UTC
            </p>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="{dashboard_url}" style="display: inline-block; background-color: #281C59; color: #ffffff; font-weight: 600; font-size: 13px; text-decoration: none; padding: 11px 26px; border-radius: 8px;">
          View Security Dashboard →
        </a>
      </div>

      <p style="font-size: 12px; line-height: 18px; color: #71717a; margin: 20px 0 0;">
        If you did not perform this login, please secure your account credentials immediately.
      </p>
    """
    return _wrap_email_layout("Security Alert: New Sign-in", banner, body)


async def send_resend_email_async(to_email: str, subject: str, html_content: str) -> bool:
    """Send an email using Resend REST API asynchronously."""
    if not _is_deliverable_email(to_email):
        logger.info("Skipping email send for non-deliverable address: %s", to_email)
        return False

    api_key = settings.RESEND_API_KEY
    if not api_key:
        logger.warning("RESEND_API_KEY is not configured; skipping email to %s", to_email)
        return False

    from_addr = settings.RESEND_FROM_EMAIL or "Secura <hello@secura.ink>"

    payload = {
        "from": from_addr,
        "to": [to_email.strip().lower()],
        "subject": subject,
        "html": html_content,
    }

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(RESEND_API_URL, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                res_data = resp.json()
                logger.info("Successfully sent Resend email '%s' to %s (id: %s)", subject, to_email, res_data.get("id"))
                return True
            else:
                logger.error("Failed to send Resend email to %s: HTTP %s - %s", to_email, resp.status_code, resp.text)
                return False
    except Exception as e:
        logger.exception("Exception occurred while sending Resend email to %s: %s", to_email, e)
        return False


def _enqueue_email(
    to_email: str,
    subject: str,
    html: str,
    background_tasks: Optional[BackgroundTasks] = None,
):
    if background_tasks is not None:
        background_tasks.add_task(send_resend_email_async, to_email, subject, html)
    else:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(send_resend_email_async(to_email, subject, html))
            else:
                asyncio.run(send_resend_email_async(to_email, subject, html))
        except Exception:
            pass


def dispatch_welcome_email(
    to_email: str,
    user_name: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None,
):
    """Queue welcome email on background task worker."""
    try:
        if not _is_deliverable_email(to_email):
            return

        name = user_name or to_email.split("@")[0]
        dashboard_url = settings.SECURA_DASHBOARD_URL.rstrip("/") + "/dashboard"
        html = _generate_welcome_html(name, dashboard_url)
        subject = "Welcome to Secura — Next-Gen Repository Security"
        _enqueue_email(to_email, subject, html, background_tasks)
    except Exception as e:
        logger.warning("Failed to dispatch welcome email to %s: %s", to_email, e)


def dispatch_login_email(
    to_email: str,
    user_name: Optional[str] = None,
    provider: str = "credentials",
    background_tasks: Optional[BackgroundTasks] = None,
):
    """Queue login notification email on background task worker."""
    try:
        if not _is_deliverable_email(to_email):
            return

        name = user_name or to_email.split("@")[0]
        dashboard_url = settings.SECURA_DASHBOARD_URL.rstrip("/") + "/dashboard"
        timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        html = _generate_login_html(name, provider, timestamp_str, dashboard_url)
        subject = f"Security Notice: New Secura sign-in ({provider.upper()})"
        _enqueue_email(to_email, subject, html, background_tasks)
    except Exception as e:
        logger.warning("Failed to dispatch login email to %s: %s", to_email, e)
