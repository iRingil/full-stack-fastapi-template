"""A module for managing all email-related operations."""

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import ClassVar, Literal

import jwt
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader, Template, select_autoescape
from jwt.exceptions import InvalidTokenError
from loguru import logger
from pydantic import NameEmail, SecretStr

from app.core.config import Settings, get_settings
from app.core.log_setup import describe_exception
from app.core.security import SecurityManager, get_security_manager

__all__: tuple[str, ...] = ("EmailManager", "get_email_manager")


type TokenPurpose = Literal["password_reset", "email_verify"]
type TemplateContext = dict[str, str | int]


class EmailManager:
    """A class for managing all operations related to email."""

    # The 'purpose' claim keeps a token of one kind from being accepted as another
    _PURPOSE_CLAIM: ClassVar[str] = "purpose"

    def __init__(self, settings: Settings, security_manager: SecurityManager) -> None:
        """
        Initializes the email manager.

        :param settings: The application settings object.
        :param security_manager: The security manager instance.
        """
        self._settings: Settings = settings
        self._security_manager: SecurityManager = security_manager
        self._fm: FastMail | None = None
        # The same condition as Settings.emails_enabled, spelled out so that the values are known to be set
        smtp_host: str | None = self._settings.SMTP_HOST
        emails_from: str | None = self._settings.EMAILS_FROM_EMAIL
        if smtp_host and emails_from:
            self._fm = FastMail(
                config=ConnectionConfig(
                    MAIL_USERNAME=self._settings.SMTP_USER or "",
                    MAIL_PASSWORD=self._settings.SMTP_PASSWORD or SecretStr(""),
                    MAIL_FROM=emails_from,
                    MAIL_FROM_NAME=self._settings.EMAILS_FROM_NAME,
                    MAIL_PORT=self._settings.SMTP_PORT,
                    MAIL_SERVER=smtp_host,
                    MAIL_STARTTLS=self._settings.SMTP_TLS,
                    MAIL_SSL_TLS=self._settings.SMTP_SSL,
                    USE_CREDENTIALS=bool(self._settings.SMTP_USER),
                    VALIDATE_CERTS=True,
                )
            )
        self._jinja_env: Environment = Environment(
            loader=FileSystemLoader(searchpath=self._settings.BASE_DIR / "app" / "email-templates" / "build"),
            autoescape=select_autoescape(enabled_extensions=["html", "xml"]),
            enable_async=True,
        )

    async def _render_template(self, template_name: str, context: TemplateContext) -> str:
        """
        Asynchronously renders a Jinja2 template into an HTML string.

        :param template_name: Template name.
        :param context: Dictionary of arguments for template.
        :return: HTML string.
        """
        template: Template = self._jinja_env.get_template(name=template_name)
        return await template.render_async(context)

    async def _send_email(self, email_to: str, subject: str, html_content: str) -> None:
        """
        The main method for sending a mail.

        :param email_to: The email address of the recipient.
        :param subject: The subject of the email.
        :param html_content: The HTML content of the email.
        :return: None
        """
        if not self._fm:
            logger.warning("Email sending is disabled or not configured. The letter has not been sent.")
            return
        message: MessageSchema = MessageSchema(
            subject=subject,
            recipients=[NameEmail(name=email_to, email=email_to)],
            body=html_content,
            subtype=MessageType.html,
        )
        try:
            await self._fm.send_message(message=message)
            logger.info(f"Email sent to {email_to} with subject '{subject}'")
        except Exception as exc:  # noqa: BLE001 - a failed delivery is logged, the caller is not interrupted
            logger.error(f"Failed to send email to {email_to}: {describe_exception(exc=exc)}")

    # Tokens
    def _generate_token(self, *, email: str, purpose: TokenPurpose, expires_delta: timedelta) -> str:
        """
        Generates a JWT token for an email link.

        :param email: The subject of the token.
        :param purpose: What the token may be used for.
        :param expires_delta: The lifetime of the token.
        :return: The encoded JWT token as a string.
        """
        now: datetime = datetime.now(tz=UTC)
        payload: dict[str, datetime | float | str] = {
            "exp": (now + expires_delta).timestamp(),
            "nbf": now,
            "sub": email,
            self._PURPOSE_CLAIM: purpose,
        }
        return jwt.encode(
            payload=payload,
            key=self._settings.SECRET_KEY.get_secret_value(),
            algorithm=self._security_manager.ALGORITHM,
        )

    def _verify_token(self, *, token: str, purpose: TokenPurpose) -> str | None:
        """
        Verifies a JWT token from an email link.

        :param token: The JWT token to verify.
        :param purpose: What the token is expected to be used for.
        :return: The email address of the user if the token is valid and has this purpose, None otherwise.
        """
        try:
            decoded_token: dict[str, object] = jwt.decode(
                jwt=token,
                key=self._settings.SECRET_KEY.get_secret_value(),
                algorithms=[self._security_manager.ALGORITHM],
            )
        except InvalidTokenError:
            return None
        if decoded_token.get(self._PURPOSE_CLAIM) != purpose:
            return None
        email: object = decoded_token.get("sub")
        return email if isinstance(email, str) else None

    def generate_password_reset_token(self, email: str) -> str:
        """
        Generates a JWT token for password reset.

        :param email: The email address of the user.
        :return: The encoded JWT token as a string.
        """
        delta: timedelta = timedelta(hours=self._settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
        return self._generate_token(email=email, purpose="password_reset", expires_delta=delta)

    def verify_password_reset_token(self, token: str) -> str | None:
        """
        Verifies a password reset JWT token.

        :param token: The JWT token to verify.
        :return: The email address of the user if the token is valid, None otherwise.
        """
        return self._verify_token(token=token, purpose="password_reset")

    def generate_email_verify_token(self, email: str) -> str:
        """
        Generates a JWT token for email verification.

        :param email: The email address of the user.
        :return: The encoded JWT token as a string.
        """
        delta: timedelta = timedelta(hours=self._settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS)
        return self._generate_token(email=email, purpose="email_verify", expires_delta=delta)

    def verify_email_verify_token(self, token: str) -> str | None:
        """
        Verifies an email verification JWT token.

        :param token: The JWT token to verify.
        :return: The email address of the user if the token is valid, None otherwise.
        """
        return self._verify_token(token=token, purpose="email_verify")

    # Emails
    async def send_test_email(self, email_to: str) -> None:
        """
        Sends a test email.

        :param email_to: The email address of the recipient.
        :return: None
        """
        subject: str = f"{self._settings.PROJECT_NAME} - Test email"
        html_content: str = await self._render_template(
            template_name="test_email.html",
            context={"project_name": self._settings.PROJECT_NAME, "email": email_to},
        )
        await self._send_email(email_to=email_to, subject=subject, html_content=html_content)

    async def render_reset_password_email(self, email_to: str) -> tuple[str, str]:
        """
        Renders a password recovery email without sending it.

        :param email_to: The email address of the recipient.
        :return: The subject and the HTML content of the email.
        """
        subject: str = f"{self._settings.PROJECT_NAME} - Password recovery for user {email_to}"
        token: str = self.generate_password_reset_token(email=email_to)
        html_content: str = await self._render_template(
            template_name="reset_password.html",
            context={
                "project_name": self._settings.PROJECT_NAME,
                "username": email_to,
                "email": email_to,
                "valid_hours": self._settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
                "link": f"{self._settings.FRONTEND_HOST}/reset-password?token={token}",
            },
        )
        return subject, html_content

    async def send_reset_password_email(self, email_to: str) -> None:
        """
        Sends a password recovery email to the specified email address.

        :param email_to: The email address of the recipient.
        :return: None
        """
        subject, html_content = await self.render_reset_password_email(email_to=email_to)
        await self._send_email(email_to=email_to, subject=subject, html_content=html_content)

    async def _send_verification_type_email(
        self, *, email_to: str, username: str, subject_text: str, template_name: str
    ) -> None:
        """
        A private helper to send emails that carry an email verification link.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :param subject_text: The subject of the email (after the project name).
        :param template_name: The name of the HTML template file to use.
        :return: None
        """
        subject: str = f"{self._settings.PROJECT_NAME} - {subject_text}"
        token: str = self.generate_email_verify_token(email=email_to)
        html_content: str = await self._render_template(
            template_name=template_name,
            context={
                "project_name": self._settings.PROJECT_NAME,
                "username": username,
                "valid_hours": self._settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS,
                "link": f"{self._settings.FRONTEND_HOST}/verify-email?token={token}",
            },
        )
        await self._send_email(email_to=email_to, subject=subject, html_content=html_content)

    async def send_verification_email(self, email_to: str, username: str) -> None:
        """
        Sends an email to a user with an account verification link.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :return: None
        """
        await self._send_verification_type_email(
            email_to=email_to, username=username, subject_text="Verify your email", template_name="verify_email.html"
        )

    async def send_welcome_email(self, email_to: str, username: str) -> None:
        """
        Sends a welcome email with an email verification link to a newly created user.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :return: None
        """
        await self._send_verification_type_email(
            email_to=email_to, username=username, subject_text="Welcome aboard!", template_name="welcome_email.html"
        )


@lru_cache(maxsize=1)
def get_email_manager() -> EmailManager:
    """
    Gets the EmailManager object. The lru_cache decorator ensures this function is only called once.

    :return: An instance of EmailManager.
    """
    return EmailManager(settings=get_settings(), security_manager=get_security_manager())
