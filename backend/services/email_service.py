"""
RoadmapAI — Email Delivery Service
Supports safe offline development via EMAIL_MODE=console (default).
In console mode, follow-up emails and secure token URLs are printed directly to logs/stdout.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import FRONTEND_URL
from core.logging import get_logger

logger = get_logger("services.email_service")

EMAIL_MODE = os.environ.get("EMAIL_MODE", "console").lower()
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")


def render_follow_up_template(
    business_name: str,
    issue_title: str,
    action_taken: str,
    token: str,
    base_url: str = None
) -> tuple[str, str, str]:
    """
    Renders deterministic subject and body for follow-up email.
    Link uses only the secure token — never internal database IDs.
    """
    base_url = (base_url or FRONTEND_URL or "http://localhost:3000").rstrip("/")
    follow_up_link = f"{base_url}/follow-up/{token}"

    subject = f"[{business_name}] We acted on your feedback"
    body = f"""Hi,

You previously shared feedback regarding:
"{issue_title}"

We wanted to confirm that action has been taken:
"{action_taken}"

Has your experience improved?

Please click the link below to share a quick response (takes about 5 seconds):
{follow_up_link}

Thank you for helping us improve {business_name}.

Best regards,
The {business_name} Team
"""
    return subject, body, follow_up_link


def send_follow_up_email(
    to_email: str,
    business_name: str,
    issue_title: str,
    action_taken: str,
    token: str,
    base_url: str = None
) -> bool:
    """
    Sends a follow-up email or logs it if EMAIL_MODE=console.
    """
    subject, body, link = render_follow_up_template(
        business_name=business_name,
        issue_title=issue_title,
        action_taken=action_taken,
        token=token,
        base_url=base_url
    )

    if EMAIL_MODE == "console":
        logger.info(
            f"\n"
            f"========== [DEVELOPMENT EMAIL MODE: CONSOLE] ==========\n"
            f"TO:      {to_email}\n"
            f"SUBJECT: {subject}\n"
            f"LINK:    {link}\n"
            f"-------------------------------------------------------\n"
            f"{body}\n"
            f"=======================================================\n"
        )
        return True

    # Real SMTP Delivery
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(
            f"SMTP credentials missing. Defaulting to console log for email to {to_email}."
        )
        logger.info(f"Follow-up link for {to_email}: {link}")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info(f"Follow-up email successfully sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send follow-up email to {to_email}: {e}")
        return False
