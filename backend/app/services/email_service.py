"""Email service for verification and password reset emails.

Uses fastapi-mail for sending. Falls back to console logging if SMTP
connection fails so dev environments without Mailtrap/MailHog don't crash.

Tokens are JWTs (HS256) with:
  - sub: str(user_id)
  - type: "email_verify" | "password_reset"
  - exp: 24h from now
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings

logger = logging.getLogger(__name__)


def _create_email_token(user_id: int, token_type: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode(
        {"sub": str(user_id), "type": token_type, "exp": expire},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def _get_mail_config() -> ConnectionConfig:
    # Normalize the from address — fastapi-mail validates it as a real email.
    # If the configured address uses a local/reserved domain, fall back to a safe default.
    from_email = settings.EMAILS_FROM_EMAIL
    if from_email.endswith(".local") or "@" not in from_email:
        from_email = "noreply@healthconnect.dev"

    return ConnectionConfig(
        MAIL_USERNAME=settings.SMTP_USER,
        MAIL_PASSWORD=settings.SMTP_PASSWORD,
        MAIL_FROM=from_email,
        MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
        MAIL_PORT=settings.SMTP_PORT,
        MAIL_SERVER=settings.SMTP_HOST,
        MAIL_STARTTLS=False,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=bool(settings.SMTP_USER),
        VALIDATE_CERTS=False,
    )


async def send_verification_email(email: str, user_id: int) -> None:
    """Send email verification link. Logs to console if SMTP unavailable."""
    token = _create_email_token(user_id, "email_verify")
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    html_body = f"""
    <h2>Verify your HealthConnect account</h2>
    <p>Click the link below to verify your email address:</p>
    <p><a href="{verify_url}">{verify_url}</a></p>
    <p>This link expires in 24 hours.</p>
    """

    try:
        conf = _get_mail_config()
        fm = FastMail(conf)
        message = MessageSchema(
            subject="Verify your HealthConnect email",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html,
        )
        await fm.send_message(message)
        logger.info("Verification email sent to %s", email)
    except Exception as exc:
        # Dev fallback — log the token so developers can verify manually
        logger.warning(
            "SMTP unavailable (%s). Verification URL for %s: %s",
            exc,
            email,
            verify_url,
        )


async def send_password_reset_email(email: str, user_id: int) -> None:
    """Send password reset link. Logs to console if SMTP unavailable."""
    token = _create_email_token(user_id, "password_reset")
    reset_url = f"{settings.FRONTEND_URL}/forgot-password/reset?token={token}"

    html_body = f"""
    <h2>Reset your HealthConnect password</h2>
    <p>Click the link below to reset your password:</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>This link expires in 24 hours. If you did not request this, ignore this email.</p>
    """

    try:
        conf = _get_mail_config()
        fm = FastMail(conf)
        message = MessageSchema(
            subject="Reset your HealthConnect password",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html,
        )
        await fm.send_message(message)
        logger.info("Password reset email sent to %s", email)
    except Exception as exc:
        logger.warning(
            "SMTP unavailable (%s). Password reset URL for %s: %s",
            exc,
            email,
            reset_url,
        )
