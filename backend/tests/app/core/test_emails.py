"""
Tests for src/app/core/emails.py (EmailManager): tokens, templates and delivery.

Delivery is real where it can be: with SMTP off nothing is sent, a refused SMTP connection is logged, and the
letters of a configured manager go through fastapi-mail with sending suppressed (the outbox fixture).
"""

# ruff: noqa: S101, S106, SLF001

from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

import jwt

from app.core.config import Settings
from app.core.emails import EmailManager, get_email_manager
from app.core.security import SecurityManager
from tests.conftest import html_of, text_of, with_settings

__all__: tuple[str, ...] = ()


class TestTokens:
    """Tests for the password reset and the email verification tokens."""

    def test_round_trips(self, email_manager: EmailManager) -> None:
        """
        Each token verifies with its own purpose.

        :param email_manager: The test email manager.
        :return: None
        """
        reset: str = email_manager.generate_password_reset_token(email="a@example.com", version=7)
        verify: str = email_manager.generate_email_verify_token(email="a@example.com")
        assert email_manager.verify_password_reset_token(token=reset) == ("a@example.com", 7)
        assert email_manager.verify_email_verify_token(token=verify) == "a@example.com"

    def test_purposes_are_not_interchangeable(
        self, email_manager: EmailManager, security_manager: SecurityManager
    ) -> None:
        """
        A token of one purpose is rejected as the other, and an access token as either.

        :param email_manager: The test email manager.
        :param security_manager: The test security manager.
        :return: None
        """
        reset: str = email_manager.generate_password_reset_token(email="a@example.com", version=0)
        verify: str = email_manager.generate_email_verify_token(email="a@example.com")
        access: str = security_manager.create_access_token(subject="a@example.com", expires_delta=timedelta(minutes=1))
        assert email_manager.verify_email_verify_token(token=reset) is None
        assert email_manager.verify_password_reset_token(token=verify) is None
        assert email_manager.verify_password_reset_token(token=access) is None

    def test_rejects_invalid_tokens(self, email_manager: EmailManager, settings: Settings) -> None:
        """
        A garbage token, a token without a string subject and a reset token without a version are rejected.

        :param email_manager: The test email manager.
        :param settings: The test settings.
        :return: None
        """
        claims: dict[str, object] = {"exp": datetime.now(tz=UTC) + timedelta(minutes=1), "purpose": "password_reset"}
        no_subject, no_version = (
            jwt.encode(
                payload=payload,
                key=settings.security.secret_key.get_secret_value(),
                algorithm=SecurityManager.ALGORITHM,
            )
            for payload in (claims, {**claims, "sub": "a@example.com"})
        )
        assert email_manager.verify_password_reset_token(token="garbage") is None
        assert email_manager.verify_password_reset_token(token=no_subject) is None
        assert email_manager.verify_password_reset_token(token=no_version) is None


class TestLetters:
    """Tests for the letters, delivered with sending suppressed."""

    async def test_reset_password_letter(self, email_manager: EmailManager, outbox: list[EmailMessage]) -> None:
        """
        The recovery letter carries the link with a reset token and the validity period in both of its parts.

        The text comes first and the HTML last: a mail client shows the last alternative it can display.

        :param email_manager: The test email manager.
        :param outbox: The letters sent during the test.
        :return: None
        """
        await email_manager.send_reset_password_email(email_to="a@example.com", version=0)
        assert outbox[0]["Subject"] == "Test Project - Password recovery for user a@example.com"
        assert outbox[0]["From"] == "Test Project <noreply@example.com>"
        assert [part.get_content_type() for part in outbox[0].walk() if not part.is_multipart()] == [
            "text/plain",
            "text/html",
        ]
        for body in (text_of(letter=outbox[0]), html_of(letter=outbox[0])):
            assert "http://localhost:5173/reset-password?token=" in body
            assert "48 hours" in body

    async def test_verification_and_welcome_letters(
        self, email_manager: EmailManager, outbox: list[EmailMessage]
    ) -> None:
        """
        The verification and the welcome letters carry the verification link and greet the user by name.

        :param email_manager: The test email manager.
        :param outbox: The letters sent during the test.
        :return: None
        """
        await email_manager.send_verification_email(email_to="a@example.com", username="Jane")
        await email_manager.send_welcome_email(email_to="a@example.com", username="Jane")
        assert [letter["Subject"] for letter in outbox] == [
            "Test Project - Verify your email",
            "Test Project - Welcome aboard!",
        ]
        for letter in outbox:
            for body in (text_of(letter=letter), html_of(letter=letter)):
                assert "http://localhost:5173/verify-email?token=" in body
                assert "Jane" in body
                assert "24 hours" in body

    async def test_values_are_html_escaped(self, email_manager: EmailManager, outbox: list[EmailMessage]) -> None:
        """
        A user-controlled value is escaped in the HTML and kept as it is in the text.

        :param email_manager: The test email manager.
        :param outbox: The letters sent during the test.
        :return: None
        """
        await email_manager.send_welcome_email(email_to="a@example.com", username="<b>Jane</b>")
        html: str = html_of(letter=outbox[0])
        assert "&lt;b&gt;Jane&lt;/b&gt;" in html
        assert "<b>Jane</b>" not in html
        assert "Welcome, <b>Jane</b>!" in text_of(letter=outbox[0])


class TestDelivery:
    """Tests for the delivery without a working SMTP server."""

    async def test_smtp_off(
        self, settings: Settings, security_manager: SecurityManager, log_messages: list[str]
    ) -> None:
        """
        Without SMTP settings nothing is sent, and a warning is logged.

        :param settings: The test settings (no SMTP).
        :param security_manager: The test security manager.
        :param log_messages: The messages logged during the test.
        :return: None
        """
        email_manager: EmailManager = EmailManager(settings=settings, security_manager=security_manager)
        assert email_manager._fm is None
        await email_manager.send_test_email(email_to="a@example.com")
        assert log_messages == ["Email sending is disabled or not configured. The letter has not been sent."]

    async def test_refused_connection_is_logged(
        self, settings: Settings, security_manager: SecurityManager, log_messages: list[str]
    ) -> None:
        """
        A refused SMTP connection (a closed port on this machine) is logged in one line, not raised.

        :param settings: The test settings.
        :param security_manager: The test security manager.
        :param log_messages: The messages logged during the test.
        :return: None
        """
        closed_port: Settings = with_settings(
            settings=with_settings(settings=settings, group="smtp", host="127.0.0.1", port=1, tls=False, user="user"),
            group="email",
            from_email="noreply@example.com",
        )
        email_manager: EmailManager = EmailManager(settings=closed_port, security_manager=security_manager)
        await email_manager.send_test_email(email_to="a@example.com")
        assert len(log_messages) == 1
        assert log_messages[0].startswith("Failed to send an email: ")
        assert "\n" not in log_messages[0]
        # The address of the recipient stays out of the log
        assert "a@example.com" not in log_messages[0]


def test_get_email_manager_is_a_singleton() -> None:
    """
    get_email_manager always returns the same manager.

    :return: None
    """
    assert get_email_manager() is get_email_manager()
