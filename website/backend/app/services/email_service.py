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


def _generate_welcome_html(user_name: str, dashboard_url: str) -> str:
    """Generate HTML template for welcome email upon registration."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Secura</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1117; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #181920; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #281C59 0%, #5227FF 50%, #7C3AED 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 10px; margin-bottom: 12px; backdrop-filter: blur(8px);">
                <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🛡️ Secura</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Secura Security!</h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Next-Gen Autonomous Code & Repository Security</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="font-size: 16px; line-height: 24px; color: #f4f4f5; margin: 0 0 16px;">
                Hello <strong>{user_name}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 24px;">
                Your Secura account has been created successfully. Secura is actively watching over your repositories, pull requests, and security policies so you can ship code faster without security regressions.
              </p>

              <!-- Feature Highlights -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #20222b; border: 1px solid #2e303b; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%">
                      <tr>
                        <td width="32" style="font-size: 20px; vertical-align: top; padding-top: 2px;">⚡</td>
                        <td style="padding-left: 12px;">
                          <strong style="color: #ffffff; font-size: 14px;">Automated PR Scans</strong>
                          <p style="color: #a1a1aa; font-size: 13px; margin: 2px 0 0;">Zero-delay AST and heuristic vulnerability detection across every pull request.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" height="12"></td></tr>
                      <tr>
                        <td width="32" style="font-size: 20px; vertical-align: top; padding-top: 2px;">🔐</td>
                        <td style="padding-left: 12px;">
                          <strong style="color: #ffffff; font-size: 14px;">Secret & Token Detection</strong>
                          <p style="color: #a1a1aa; font-size: 13px; margin: 2px 0 0;">Immediate alerts when API keys, database credentials, or private keys leak.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" height="12"></td></tr>
                      <tr>
                        <td width="32" style="font-size: 20px; vertical-align: top; padding-top: 2px;">📊</td>
                        <td style="padding-left: 12px;">
                          <strong style="color: #ffffff; font-size: 14px;">Security Command Center</strong>
                          <p style="color: #a1a1aa; font-size: 13px; margin: 2px 0 0;">Real-time risk scoring, compliance audits, and repo-wide health trends.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action -->
              <div style="text-align: center; margin: 32px 0 16px;">
                <a href="{dashboard_url}" style="background: linear-gradient(135deg, #7C3AED 0%, #5227FF 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                  Open Security Command Center &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #14151b; border-top: 1px solid #27272a; text-align: center;">
              <p style="font-size: 12px; color: #71717a; margin: 0 0 6px;">
                Secura Security Platform &bull; Automated Code Security
              </p>
              <p style="font-size: 11px; color: #52525b; margin: 0;">
                If you did not create this account, please disregard this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _generate_login_html(user_name: str, provider: str, timestamp_str: str, dashboard_url: str) -> str:
    """Generate HTML template for login notification email."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert: New Sign-in</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1117; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #181920; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 32px; border-bottom: 1px solid #3730a3; text-align: center;">
              <div style="display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                <span style="font-size: 26px;">🛡️</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Sign-In Detected</h1>
              <p style="color: #c7d2fe; margin: 6px 0 0; font-size: 13px;">Security Notice for Secura Account</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 32px 24px;">
              <p style="font-size: 15px; line-height: 22px; color: #f4f4f5; margin: 0 0 16px;">
                Hello <strong>{user_name}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 20px;">
                We detected a successful sign-in to your Secura Security account.
              </p>

              <!-- Sign-in Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #20222b; border: 1px solid #2e303b; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" style="font-size: 13px; color: #d4d4d8;">
                      <tr>
                        <td style="color: #71717a; padding: 4px 0; width: 120px;">Method:</td>
                        <td style="color: #ffffff; font-weight: 600; padding: 4px 0;">{provider}</td>
                      </tr>
                      <tr>
                        <td style="color: #71717a; padding: 4px 0;">Timestamp:</td>
                        <td style="color: #ffffff; padding: 4px 0;">{timestamp_str} (UTC)</td>
                      </tr>
                      <tr>
                        <td style="color: #71717a; padding: 4px 0;">Status:</td>
                        <td style="color: #34d399; font-weight: 600; padding: 4px 0;">Authenticated</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 20px; color: #71717a; margin: 0 0 24px;">
                If you initiated this sign-in, no further action is required. If you did not sign in or suspect unauthorized access, please review your account immediately.
              </p>

              <!-- Action Link -->
              <div style="text-align: center; margin: 20px 0;">
                <a href="{dashboard_url}" style="background-color: #27272a; border: 1px solid #3f3f46; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 500; font-size: 13px; display: inline-block;">
                  Go to Secura Dashboard &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; background-color: #14151b; border-top: 1px solid #27272a; text-align: center;">
              <p style="font-size: 11px; color: #71717a; margin: 0;">
                Secura Security Command Center &bull; Automated Protection
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
                logger.error("Resend API error [%s]: %s (to: %s)", resp.status_code, resp.text, to_email)
                return False
    except Exception as exc:
        logger.error("Exception while sending email via Resend to %s: %s", to_email, exc)
        return False


def dispatch_welcome_email(
    to_email: str,
    user_name: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None,
):
    """
    Dispatch a welcome email to a newly registered user.
    Uses FastAPI BackgroundTasks if provided, or runs as a non-blocking coroutine.
    """
    clean_name = (user_name or "Developer").strip()
    dashboard_url = getattr(settings, "SECURA_DASHBOARD_URL", "https://secura-frontend.vercel.app")
    html = _generate_welcome_html(clean_name, dashboard_url)
    subject = "Welcome to Secura Security Command Center! 🛡️"

    if background_tasks is not None:
        background_tasks.add_task(send_resend_email_async, to_email, subject, html)
    else:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(send_resend_email_async(to_email, subject, html))
        except RuntimeError:
            # If no running loop, run synchronously in separate thread
            import threading
            threading.Thread(
                target=lambda: asyncio.run(send_resend_email_async(to_email, subject, html)),
                daemon=True,
            ).start()


def dispatch_login_email(
    to_email: str,
    user_name: Optional[str] = None,
    provider: str = "Email/Password",
    background_tasks: Optional[BackgroundTasks] = None,
):
    """
    Dispatch a security login notification email to an existing user.
    """
    clean_name = (user_name or "Developer").strip()
    dashboard_url = getattr(settings, "SECURA_DASHBOARD_URL", "https://secura-frontend.vercel.app")
    timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    html = _generate_login_html(clean_name, provider, timestamp_str, dashboard_url)
    subject = "Security Notice: New Sign-in to your Secura Account 🛡️"

    if background_tasks is not None:
        background_tasks.add_task(send_resend_email_async, to_email, subject, html)
    else:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(send_resend_email_async(to_email, subject, html))
        except RuntimeError:
            import threading
            threading.Thread(
                target=lambda: asyncio.run(send_resend_email_async(to_email, subject, html)),
                daemon=True,
            ).start()

