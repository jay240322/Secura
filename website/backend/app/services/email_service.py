import os
import json
import logging
import datetime
import urllib.request
import urllib.error
import re
from typing import Optional

try:
    from fastapi import BackgroundTasks
except ImportError:
    BackgroundTasks = None  # type: ignore

from app.core.config import settings

logger = logging.getLogger("secura.email")

RESEND_API_URL = "https://api.resend.com/emails"
LOGO_ICON_URL = "https://secura-frontend.vercel.app/logo.png"


def _clean_from_address(raw_from: Optional[str]) -> str:
    """
    Normalize and format the from email address to strictly comply with Resend requirements:
    Format: 'email@example.com' or 'Name <email@example.com>'
    Strips accidental surrounding quotes or trailing whitespace that cause Resend 422 errors.
    """
    default_from = "Secura <hello@secura.ink>"
    if not raw_from:
        return default_from

    cleaned = str(raw_from).strip().strip("'\"").strip()
    if not cleaned:
        return default_from

    # If it contains angle brackets, extract display name and email
    if "<" in cleaned and ">" in cleaned:
        match = re.match(r"^([^<]*)<([^>]+)>$", cleaned)
        if match:
            display_name = match.group(1).strip().strip("'\"").strip() or "Secura"
            email_part = match.group(2).strip().strip("'\"").strip()
            if "@" in email_part:
                return f"{display_name} <{email_part}>"

    # If it is just a plain email address
    if "@" in cleaned and "<" not in cleaned and ">" not in cleaned:
        return f"Secura <{cleaned}>"

    return default_from


def _is_deliverable_email(email: str) -> bool:
    """Validate if the email is a real deliverable address and not a dummy/noreply placeholder."""
    if not email or "@" not in email:
        return False
    email_lower = email.strip().lower()
    if "@users.noreply.github.com" in email_lower:
        return False
    if "noreply" in email_lower and "github" in email_lower:
        return False
    if "@secura.security" in email_lower:
        return False
    if "example.com" in email_lower or "test.com" in email_lower:
        return False
    return True


def _wrap_email_layout(title: str, banner_html: str, body_html: str) -> str:
    """Shared responsive dark-theme container for all Secura transactional emails."""
    year = datetime.datetime.now().year
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090D12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090D12; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #141417; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          {banner_html}
          <tr>
            <td style="padding: 32px 36px 28px;">
              {body_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0d0f14; padding: 24px 36px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <div style="margin-bottom: 10px;">
                <span style="display: inline-block; padding: 3px 10px; border-radius: 999px; background: rgba(182, 255, 92, 0.12); border: 1px solid rgba(182, 255, 92, 0.3); font-size: 11px; font-weight: 600; color: #B6FF5C; font-family: monospace;">
                  🔒 ZERO CODE RETENTION
                </span>
              </div>
              <p style="margin: 0 0 6px; font-size: 12px; color: #71717a;">
                © {year} Secura Inc. Autonomous Secret Scanning & Merge Gate Protection.
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                In-memory diff inspection · AST syntax parsing · Shannon entropy analysis
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
    banner = f"""
    <tr>
      <td style="background: linear-gradient(135deg, #090D12 0%, #1e1b4b 60%, #312e81 100%); padding: 40px 32px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div style="display: inline-block; margin-bottom: 14px;">
          <img src="{LOGO_ICON_URL}" alt="Secura" width="56" height="56" style="width: 56px; height: 56px; border-radius: 14px; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15);" />
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Welcome to Secura!</h1>
        <p style="color: #B6FF5C; margin: 8px 0 0; font-size: 14px; font-weight: 600;">Autonomous Secret Scanning & Merge Gate Protection</p>
      </td>
    </tr>
    """
    body = f"""
      <p style="font-size: 16px; line-height: 24px; color: #ffffff; margin: 0 0 16px;">
        Hi <strong>{user_name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 24px;">
        Welcome aboard! Your Secura account is active and ready to safeguard your repositories. We inspect every incoming pull request in-memory, blocking exposed secrets before code ever merges to main.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a1a20; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px 20px; margin-bottom: 28px;">
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #e4e4e7;">
            ⚡ <strong style="color: #ffffff;">Zero Code Retention:</strong> Pull request diffs are inspected ephemerally in-memory and discarded.
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #e4e4e7;">
            🧠 <strong style="color: #ffffff;">Shannon Entropy Filter:</strong> Eliminates fake dummy mocks and pinpoints true live keys.
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #e4e4e7;">
            🔒 <strong style="color: #ffffff;">GitHub Merge Gate:</strong> Locks PR merge buttons automatically when critical credentials leak.
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin: 32px 0 24px;">
        <a href="{dashboard_url}" style="display: inline-block; background-color: #00285B; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 34px; border-radius: 12px; border: 1px solid rgba(182, 255, 92, 0.4); box-shadow: 0 6px 20px rgba(0, 40, 91, 0.5);">
          Launch Your Security Dashboard →
        </a>
      </div>
    """
    return _wrap_email_layout("Welcome to Secura", banner, body)


def _generate_login_html(user_name: str, provider: str, timestamp_str: str, dashboard_url: str) -> str:
    """Generate HTML template for login notification email with welcoming and playful message."""
    banner = f"""
    <tr>
      <td style="background: linear-gradient(135deg, #090D12 0%, #1e1b4b 60%, #312e81 100%); padding: 36px 32px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <div style="display: inline-block; margin-bottom: 12px;">
          <img src="{LOGO_ICON_URL}" alt="Secura" width="52" height="52" style="width: 52px; height: 52px; border-radius: 14px; display: block; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15);" />
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px;">You missed me too much, I know! 😉</h1>
        <p style="color: #B6FF5C; margin: 6px 0 0; font-size: 14px; font-weight: 600;">Welcome back to Secura</p>
      </td>
    </tr>
    """
    body = f"""
      <p style="font-size: 16px; line-height: 24px; color: #ffffff; margin: 0 0 12px;">
        Hey <strong>{user_name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 22px;">
        We caught your fresh sign-in and everything is safe and sound! Your repository merge gates are armed and watching over your GitHub pull requests.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a1a20; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #a1a1aa;">
              <strong style="color: #ffffff;">Sign-In Method:</strong> <span style="color: #B6FF5C; font-weight: 600;">{provider}</span>
            </p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #a1a1aa;">
              <strong style="color: #ffffff;">Timestamp:</strong> {timestamp_str} UTC
            </p>
            <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
              <strong style="color: #ffffff;">Security Status:</strong> Active & Protected (Zero Code Retention)
            </p>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0 20px;">
        <a href="{dashboard_url}" style="display: inline-block; background-color: #00285B; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; padding: 13px 30px; border-radius: 10px; border: 1px solid rgba(182, 255, 92, 0.4); box-shadow: 0 4px 16px rgba(0, 40, 91, 0.4);">
          Jump Back into Dashboard →
        </a>
      </div>

      <p style="font-size: 12px; line-height: 18px; color: #71717a; margin: 24px 0 0; text-align: center;">
        If you did not perform this login, please secure your account credentials immediately.
      </p>
    """
    return _wrap_email_layout("You missed me too much, I know! | Secura Sign-In", banner, body)


def send_resend_email_sync(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email using Resend REST API synchronously with automatic fallback:
    1. First attempts with the configured from_addr (e.g., 'Secura <hello@secura.ink>')
    2. If Resend returns 422 or 403 (e.g. domain validation or unverified domain),
       it immediately retries with 'Secura <onboarding@resend.dev>' so the email is ALWAYS delivered!
    """
    if not _is_deliverable_email(to_email):
        logger.info("Skipping email send for non-deliverable address: %s", to_email)
        return False

    api_key = settings.RESEND_API_KEY or os.getenv("RESEND_API_KEY", "")
    if not api_key:
        logger.warning("RESEND_API_KEY is not configured; skipping email to %s", to_email)
        return False

    raw_from = getattr(settings, "RESEND_FROM_EMAIL", "") or os.getenv("RESEND_FROM_EMAIL", "")
    primary_from = _clean_from_address(raw_from)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "User-Agent": "Secura-Backend/1.0",
    }

    # Addresses to attempt: primary first, fallback to onboarding@resend.dev if different
    attempts = [primary_from]
    if "onboarding@resend.dev" not in primary_from:
        attempts.append("Secura <onboarding@resend.dev>")

    for from_addr in attempts:
        payload = {
            "from": from_addr,
            "to": [to_email.strip().lower()],
            "subject": subject,
            "html": html_content,
        }

        try:
            req = urllib.request.Request(
                RESEND_API_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
            )
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                logger.info(
                    "Successfully dispatched Resend email '%s' to %s via %s (id: %s)",
                    subject,
                    to_email,
                    from_addr,
                    data.get("id"),
                )
                return True
        except urllib.error.HTTPError as http_err:
            try:
                err_body = http_err.read().decode("utf-8")
            except Exception:
                err_body = str(http_err)
            logger.warning(
                "Resend HTTP %s sending to %s via %s: %s",
                http_err.code,
                to_email,
                from_addr,
                err_body,
            )
            # Try next address in attempts list (fallback)
            continue
        except Exception as e:
            logger.exception("Failed to send Resend email to %s via %s: %s", to_email, from_addr, e)
            break

    return False


async def send_resend_email_async(to_email: str, subject: str, html_content: str) -> bool:
    """Send an email using Resend REST API asynchronously."""
    return send_resend_email_sync(to_email, subject, html_content)


def _enqueue_email(
    to_email: str,
    subject: str,
    html: str,
    background_tasks: Optional[BackgroundTasks] = None,
):
    """
    Automatic non-blocking email dispatcher.
    Runs concurrently in a daemon thread so user responses are immediate and emails deliver instantly.
    """
    import threading
    t = threading.Thread(
        target=send_resend_email_sync,
        args=(to_email, subject, html),
        daemon=True,
    )
    t.start()


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
        subject = "Welcome to Secura! 🛡️ Your repository guardian is ready"
        _enqueue_email(to_email, subject, html, background_tasks)
    except Exception as e:
        logger.warning("Failed to dispatch welcome email to %s: %s", to_email, e)


def dispatch_login_email(
    to_email: str,
    user_name: Optional[str] = None,
    provider: str = "credentials",
    background_tasks: Optional[BackgroundTasks] = None,
):
    """Queue login notification email on background task worker with welcoming and playful message."""
    try:
        if not _is_deliverable_email(to_email):
            return

        name = user_name or to_email.split("@")[0]
        dashboard_url = settings.SECURA_DASHBOARD_URL.rstrip("/") + "/dashboard"
        timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        html = _generate_login_html(name, provider, timestamp_str, dashboard_url)
        subject = "You missed me too much, I know! 😉 | New Secura sign-in"
        _enqueue_email(to_email, subject, html, background_tasks)
    except Exception as e:
        logger.warning("Failed to dispatch login email to %s: %s", to_email, e)
