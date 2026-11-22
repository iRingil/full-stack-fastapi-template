"""A module for managing all email-related operations."""

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import ClassVar, Literal, NamedTuple

import jwt
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType, MultipartSubtypeEnum
from jinja2 import Environment, FileSystemLoader, Template, select_autoescape
from jwt.exceptions import InvalidTokenError
from loguru import logger
from pydantic import NameEmail, SecretStr

from app.core.config import Settings, get_settings
from app.core.constants import BASE_DIR
from app.core.log_setup import describe_exception
from app.core.security import SecurityManager, get_security_manager

__all__: tuple[str, ...] = ("EmailManager", "Letter", "get_email_manager")


type TokenPurpose = Literal["password_reset", "email_verify"]
type TemplateContext = dict[str, str | int]


class Letter(NamedTuple):
    """
    A rendered email: its subject and its body as plain text and as HTML.

    :param subject: The subject of the email.
    :param text: The plain text body.
    :param html: The HTML body.
    """

    subject: str
    text: str
    html: str


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
        smtp_host: str | None = self._settings.smtp.host
        emails_from: str | None = self._settings.email.from_email
        if smtp_host and emails_from:
            self._fm = FastMail(
                config=ConnectionConfig(
                    MAIL_USERNAME=self._settings.smtp.user or "",
                    MAIL_PASSWORD=self._settings.smtp.password or SecretStr(""),
                    MAIL_FROM=emails_from,
                    MAIL_FROM_NAME=self._settings.email.from_name,
                    MAIL_PORT=self._settings.smtp.port,
                    MAIL_SERVER=smtp_host,
                    MAIL_STARTTLS=self._settings.smtp.tls,
                    MAIL_SSL_TLS=self._settings.smtp.ssl,
                    USE_CREDENTIALS=bool(self._settings.smtp.user),
                    VALIDATE_CERTS=True,
                )
            )
        self._jinja_env: Environment = Environment(
            loader=FileSystemLoader(searchpath=BASE_DIR / "app" / "email-templates"),
            autoescape=select_autoescape(enabled_extensions=["html", "xml"]),
            enable_async=True,
        )

    async def _render_letter(self, *, name: str, subject: str, context: TemplateContext) -> Letter:
        """
        Renders the two templates of a letter: name.txt (not escaped) and name.html (HTML-escaped).

        :param name: The template name without the extension.
        :param subject: The subject of the letter.
        :param context: The values for the templates.
        :return: The rendered letter.
        """
        text_template: Template = self._jinja_env.get_template(name=f"{name}.txt")
        html_template: Template = self._jinja_env.get_template(name=f"{name}.html")
        return Letter(
            subject=subject,
            text=await text_template.render_async(context),
            html=await html_template.render_async(context),
        )

    async def _send_email(self, email_to: str, letter: Letter) -> None:
        """
        The main method for sending a mail: the plain text with the HTML as the preferred alternative.

        :param email_to: The email address of the recipient.
        :param letter: The rendered letter.
        :return: None
        """
        if not self._fm:
            logger.warning("Email sending is disabled or not configured. The letter has not been sent.")
            return
        message: MessageSchema = MessageSchema(
            subject=letter.subject,
            recipients=[NameEmail(name=email_to, email=email_to)],
            body=letter.text,
            subtype=MessageType.plain,
            alternative_body=letter.html,
            multipart_subtype=MultipartSubtypeEnum.alternative,
        )
        try:
            await self._fm.send_message(message=message)
            # Neither the address nor the subject (it may carry the address) goes to the log
            logger.info("Email sent")
        except Exception as exc:  # noqa: BLE001 - a failed delivery is logged, the caller is not interrupted
            logger.error(f"Failed to send an email: {describe_exception(exc=exc)}")

    # Tokens
    def _generate_token(
        self, *, email: str, purpose: TokenPurpose, expires_delta: timedelta, version: int | None = None
    ) -> str:
        """
        Generates a JWT token for an email link.

        :param email: The subject of the token.
        :param purpose: What the token may be used for.
        :param expires_delta: The lifetime of the token.
        :param version: The token version of the user, for a token that a new password must outdate.
        :return: The encoded JWT token as a string.
        """
        now: datetime = datetime.now(tz=UTC)
        payload: dict[str, datetime | float | int | str] = {
            "exp": (now + expires_delta).timestamp(),
            "nbf": now,
            "sub": email,
            self._PURPOSE_CLAIM: purpose,
        }
        if version is not None:
            payload[self._security_manager.VERSION_CLAIM] = version
        return jwt.encode(
            payload=payload,
            key=self._settings.security.secret_key.get_secret_value(),
            algorithm=self._security_manager.ALGORITHM,
        )

    def _decode_token(self, *, token: str, purpose: TokenPurpose) -> dict[str, object] | None:
        """
        Decodes a JWT token from an email link.

        :param token: The JWT token to verify.
        :param purpose: What the token is expected to be used for.
        :return: The claims if the token is valid, has this purpose and an email as the subject, None otherwise.
        """
        try:
            decoded_token: dict[str, object] = jwt.decode(
                jwt=token,
                key=self._settings.security.secret_key.get_secret_value(),
                algorithms=[self._security_manager.ALGORITHM],
            )
        except InvalidTokenError:
            return None
        if decoded_token.get(self._PURPOSE_CLAIM) != purpose:
            return None
        return decoded_token if isinstance(decoded_token.get("sub"), str) else None

    def generate_password_reset_token(self, email: str, version: int) -> str:
        """
        Generates a JWT token for password reset.

        The token carries the user's token version: a new password raises the version, so the link works once and
        the links sent earlier stop working too.

        :param email: The email address of the user.
        :param version: The token version of the user (User.token_version).
        :return: The encoded JWT token as a string.
        """
        delta: timedelta = timedelta(hours=self._settings.security.email_reset_token_expire_hours)
        return self._generate_token(email=email, purpose="password_reset", expires_delta=delta, version=version)

    def verify_password_reset_token(self, token: str) -> tuple[str, int] | None:
        """
        Verifies a password reset JWT token.

        :param token: The JWT token to verify.
        :return: The email address and the token version from the token if it is valid, None otherwise.
        """
        claims: dict[str, object] | None = self._decode_token(token=token, purpose="password_reset")
        version: object = claims.get(self._security_manager.VERSION_CLAIM) if claims else None
        return (str(claims["sub"]), version) if claims and isinstance(version, int) else None

    def generate_email_verify_token(self, email: str) -> str:
        """
        Generates a JWT token for email verification.

        :param email: The email address of the user.
        :return: The encoded JWT token as a string.
        """
        delta: timedelta = timedelta(hours=self._settings.security.email_verify_token_expire_hours)
        return self._generate_token(email=email, purpose="email_verify", expires_delta=delta)

    def verify_email_verify_token(self, token: str) -> str | None:
        """
        Verifies an email verification JWT token.

        :param token: The JWT token to verify.
        :return: The email address of the user if the token is valid, None otherwise.
        """
        claims: dict[str, object] | None = self._decode_token(token=token, purpose="email_verify")
        return str(claims["sub"]) if claims else None

    # Emails
    async def send_test_email(self, email_to: str) -> None:
        """
        Sends a test email.

        :param email_to: The email address of the recipient.
        :return: None
        """
        letter: Letter = await self._render_letter(
            name="test_email",
            subject=f"{self._settings.app.project_name} - Test email",
            context={"project_name": self._settings.app.project_name, "email": email_to},
        )
        await self._send_email(email_to=email_to, letter=letter)

    async def render_reset_password_email(self, email_to: str, version: int) -> Letter:
        """
        Renders a password recovery email without sending it.

        :param email_to: The email address of the recipient.
        :param version: The token version of the recipient (User.token_version).
        :return: The rendered letter.
        """
        token: str = self.generate_password_reset_token(email=email_to, version=version)
        return await self._render_letter(
            name="reset_password",
            subject=f"{self._settings.app.project_name} - Password recovery for user {email_to}",
            context={
                "project_name": self._settings.app.project_name,
                "username": email_to,
                "email": email_to,
                "valid_hours": self._settings.security.email_reset_token_expire_hours,
                "link": f"{self._settings.app.frontend_url}/reset-password?token={token}",
            },
        )

    async def send_reset_password_email(self, email_to: str, version: int) -> None:
        """
        Sends a password recovery email to the specified email address.

        :param email_to: The email address of the recipient.
        :param version: The token version of the recipient (User.token_version).
        :return: None
        """
        letter: Letter = await self.render_reset_password_email(email_to=email_to, version=version)
        await self._send_email(email_to=email_to, letter=letter)

    async def _send_verification_type_email(
        self, *, email_to: str, username: str, subject_text: str, template_name: str
    ) -> None:
        """
        A private helper to send emails that carry an email verification link.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :param subject_text: The subject of the email (after the project name).
        :param template_name: The name of the letter's templates, without the extension.
        :return: None
        """
        token: str = self.generate_email_verify_token(email=email_to)
        letter: Letter = await self._render_letter(
            name=template_name,
            subject=f"{self._settings.app.project_name} - {subject_text}",
            context={
                "project_name": self._settings.app.project_name,
                "username": username,
                "valid_hours": self._settings.security.email_verify_token_expire_hours,
                "link": f"{self._settings.app.frontend_url}/verify-email?token={token}",
            },
        )
        await self._send_email(email_to=email_to, letter=letter)

    async def send_verification_email(self, email_to: str, username: str) -> None:
        """
        Sends an email to a user with an account verification link.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :return: None
        """
        await self._send_verification_type_email(
            email_to=email_to, username=username, subject_text="Verify your email", template_name="verify_email"
        )

    async def send_welcome_email(self, email_to: str, username: str) -> None:
        """
        Sends a welcome email with an email verification link to a newly created user.

        :param email_to: Recipient's email address.
        :param username: The name to greet the user with.
        :return: None
        """
        await self._send_verification_type_email(
            email_to=email_to, username=username, subject_text="Welcome aboard!", template_name="welcome_email"
        )


@lru_cache(maxsize=1)
def get_email_manager() -> EmailManager:
    """
    Gets the EmailManager object. The lru_cache decorator ensures this function is only called once.

    :return: An instance of EmailManager.
    """
    return EmailManager(settings=get_settings(), security_manager=get_security_manager())
