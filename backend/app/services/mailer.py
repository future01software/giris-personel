import os
import logging
from typing import List, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger("mailer")

def _parse_recipients(value: str) -> List[str]:
    return [x.strip() for x in (value or "").split(",") if x.strip()]

def send_email(subject: str, html: str, to_emails: Optional[List[str]] = None) -> dict:
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is missing")

    mail_from = os.environ.get("MAIL_FROM", "no-reply@example.com")
    mail_from_name = os.environ.get("MAIL_FROM_NAME", "Clear2Work")

    default_to = _parse_recipients(os.environ.get("MAIL_ALERT_TO", ""))
    recipients = to_emails or default_to
    if not recipients:
        raise RuntimeError("No recipients configured (MAIL_ALERT_TO empty)")

    logger.info(f"SendGrid sending mail → subject={subject}, to={recipients}")

    message = Mail(
        from_email=Email(mail_from, mail_from_name),
        to_emails=[To(e) for e in recipients],
        subject=subject,
        html_content=Content("text/html", html),
    )

    sg = SendGridAPIClient(api_key)
    response = sg.send(message)

    logger.info(f"SendGrid response status: {response.status_code}")
    return {"status_code": response.status_code}
