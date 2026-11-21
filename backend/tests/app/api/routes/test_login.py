"""
Tests for src/app/api/routes/login.py: login, password recovery, email verification.

The requests go to the real application over the test database; letters are recorded by the outbox fixture.
"""

# ruff: noqa: PLR2004, S101, S105, S106

from email.message import EmailMessage

from httpx import AsyncClient, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.emails import EmailManager
from app.crud.user import UserCRUD
from app.models import User
from tests.conftest import USER_PASSWORD, AuthHeaders, UserFactory, html_of

__all__: tuple[str, ...] = ()


async def _reload(session: AsyncSession, user: User) -> User:
    """
    Re-reads a user from the database, discarding the state cached in the session.

    :param session: The test session.
    :param user: The user to re-read.
    :return: The fresh user.
    """
    await session.refresh(instance=user)
    return user


class TestLoginAccessToken:
    """Tests for POST /login/access-token."""

    async def test_returns_a_token_that_authenticates(self, client: AsyncClient, create_user: UserFactory) -> None:
        """
        Correct credentials give a bearer token, and the token works for /login/test-token.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/login/access-token", data={"username": user.email, "password": USER_PASSWORD}
        )
        assert response.status_code == 200
        token: dict[str, str] = response.json()
        assert token["token_type"] == "bearer"
        check: Response = await client.post(
            url="/login/test-token", headers={"Authorization": f"Bearer {token['access_token']}"}
        )
        assert check.status_code == 200
        assert check.json()["email"] == user.email

    async def test_wrong_password(self, client: AsyncClient, create_user: UserFactory) -> None:
        """
        A wrong password gives 400.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/login/access-token", data={"username": user.email, "password": "wrong-password"}
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Incorrect email or password"

    async def test_unknown_email(self, client: AsyncClient) -> None:
        """
        An unknown email gives the same 400 as a wrong password.

        :param client: The HTTP client of the application.
        :return: None
        """
        response: Response = await client.post(
            url="/login/access-token", data={"username": "nobody@example.com", "password": USER_PASSWORD}
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Incorrect email or password"

    async def test_inactive_user(self, client: AsyncClient, create_user: UserFactory) -> None:
        """
        An inactive user cannot log in.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :return: None
        """
        user: User = await create_user(is_active=False)
        response: Response = await client.post(
            url="/login/access-token", data={"username": user.email, "password": USER_PASSWORD}
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Inactive user"


class TestRecoverPassword:
    """Tests for POST /password-recovery/{email}."""

    async def test_sends_a_reset_link_to_an_existing_user(
        self, client: AsyncClient, create_user: UserFactory, outbox: list[EmailMessage], email_manager: EmailManager
    ) -> None:
        """
        An existing user gets a letter with a working password reset token.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param outbox: The letters sent during the test.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(url=f"/password-recovery/{user.email}")
        assert response.status_code == 200
        assert len(outbox) == 1
        assert outbox[0]["To"] == user.email
        html: str = html_of(letter=outbox[0])
        token: str = html.split("reset-password?token=")[1].split('"', maxsplit=1)[0]
        assert email_manager.verify_password_reset_token(token=token) == user.email

    async def test_same_answer_for_an_unknown_email(self, client: AsyncClient, outbox: list[EmailMessage]) -> None:
        """
        An unknown email gets the same answer, and nothing is sent.

        :param client: The HTTP client of the application.
        :param outbox: The letters sent during the test.
        :return: None
        """
        response: Response = await client.post(url="/password-recovery/nobody@example.com")
        assert response.status_code == 200
        assert response.json() == {"message": "If an account with that email exists, a recovery email has been sent."}
        assert outbox == []


class TestResetPassword:
    """Tests for POST /reset-password/."""

    async def test_sets_the_new_password_and_verifies_the_email(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        email_manager: EmailManager,
        session: AsyncSession,
        user_crud: UserCRUD,
    ) -> None:
        """
        A valid token sets the new password, and the email counts as verified.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :param session: The test session.
        :param user_crud: The UserCRUD over the test session.
        :return: None
        """
        user: User = await create_user()
        token: str = email_manager.generate_password_reset_token(email=user.email)
        response: Response = await client.post(
            url="/reset-password/", json={"token": token, "new_password": "brand-new-password"}
        )
        assert response.status_code == 200
        assert (await _reload(session=session, user=user)).is_email_verified
        assert await user_crud.authenticate(email=user.email, password="brand-new-password") is not None

    async def test_rejects_an_email_verification_token(
        self, client: AsyncClient, create_user: UserFactory, email_manager: EmailManager
    ) -> None:
        """
        A token of the other purpose (email verification) does not reset the password.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user()
        token: str = email_manager.generate_email_verify_token(email=user.email)
        response: Response = await client.post(
            url="/reset-password/", json={"token": token, "new_password": "brand-new-password"}
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid token"

    async def test_unknown_user(self, client: AsyncClient, email_manager: EmailManager) -> None:
        """
        A valid token of an email without a user gives 404.

        :param client: The HTTP client of the application.
        :param email_manager: The email manager of the application.
        :return: None
        """
        token: str = email_manager.generate_password_reset_token(email="nobody@example.com")
        response: Response = await client.post(
            url="/reset-password/", json={"token": token, "new_password": "brand-new-password"}
        )
        assert response.status_code == 404

    async def test_inactive_user(
        self, client: AsyncClient, create_user: UserFactory, email_manager: EmailManager
    ) -> None:
        """
        An inactive user cannot reset the password.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user(is_active=False)
        token: str = email_manager.generate_password_reset_token(email=user.email)
        response: Response = await client.post(
            url="/reset-password/", json={"token": token, "new_password": "brand-new-password"}
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Inactive user"


class TestVerifyEmail:
    """Tests for POST /verify-email/."""

    async def test_verifies_the_email(
        self, client: AsyncClient, create_user: UserFactory, email_manager: EmailManager, session: AsyncSession
    ) -> None:
        """
        A valid verification token marks the email as verified.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :param session: The test session.
        :return: None
        """
        user: User = await create_user()
        token: str = email_manager.generate_email_verify_token(email=user.email)
        response: Response = await client.post(url="/verify-email/", json={"token": token})
        assert response.status_code == 200
        assert response.json() == {"message": "Email verified successfully"}
        assert (await _reload(session=session, user=user)).is_email_verified

    async def test_already_verified(
        self, client: AsyncClient, create_user: UserFactory, email_manager: EmailManager
    ) -> None:
        """
        A verified email is reported as such.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user(is_email_verified=True)
        token: str = email_manager.generate_email_verify_token(email=user.email)
        response: Response = await client.post(url="/verify-email/", json={"token": token})
        assert response.status_code == 200
        assert response.json() == {"message": "This email has already been verified"}

    async def test_rejects_a_password_reset_token(
        self, client: AsyncClient, create_user: UserFactory, email_manager: EmailManager
    ) -> None:
        """
        A token of the other purpose (password reset) does not verify the email.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user()
        token: str = email_manager.generate_password_reset_token(email=user.email)
        response: Response = await client.post(url="/verify-email/", json={"token": token})
        assert response.status_code == 400

    async def test_unknown_user(self, client: AsyncClient, email_manager: EmailManager) -> None:
        """
        A valid token of an email without a user gives 404.

        :param client: The HTTP client of the application.
        :param email_manager: The email manager of the application.
        :return: None
        """
        token: str = email_manager.generate_email_verify_token(email="nobody@example.com")
        response: Response = await client.post(url="/verify-email/", json={"token": token})
        assert response.status_code == 404


class TestResendVerification:
    """Tests for POST /resend-verification/."""

    async def test_sends_a_verification_letter_once_a_minute(
        self, client: AsyncClient, create_user: UserFactory, outbox: list[EmailMessage], email_manager: EmailManager
    ) -> None:
        """
        An unverified user gets a letter with a working verification token; a repeated request gets 429.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param outbox: The letters sent during the test.
        :param email_manager: The email manager of the application.
        :return: None
        """
        user: User = await create_user(full_name="Jane")
        first: Response = await client.post(url="/resend-verification/", json={"email": user.email})
        second: Response = await client.post(url="/resend-verification/", json={"email": user.email})
        assert first.status_code == 200
        assert second.status_code == 429
        assert len(outbox) == 1
        html: str = html_of(letter=outbox[0])
        assert "Hello Jane" in html
        token: str = html.split("verify-email?token=")[1].split('"', maxsplit=1)[0]
        assert email_manager.verify_email_verify_token(token=token) == user.email

    async def test_nothing_for_a_verified_user(
        self, client: AsyncClient, create_user: UserFactory, outbox: list[EmailMessage]
    ) -> None:
        """
        A verified user gets the same answer and no letter.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param outbox: The letters sent during the test.
        :return: None
        """
        user: User = await create_user(is_email_verified=True)
        response: Response = await client.post(url="/resend-verification/", json={"email": user.email})
        assert response.status_code == 200
        assert outbox == []

    async def test_nothing_for_an_inactive_user(
        self, client: AsyncClient, create_user: UserFactory, outbox: list[EmailMessage]
    ) -> None:
        """
        An inactive user gets the same answer and no letter.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param outbox: The letters sent during the test.
        :return: None
        """
        user: User = await create_user(is_active=False)
        response: Response = await client.post(url="/resend-verification/", json={"email": user.email})
        assert response.status_code == 200
        assert outbox == []


class TestRecoverPasswordHtmlContent:
    """Tests for POST /password-recovery-html-content/{email}."""

    async def test_superuser_gets_the_letter(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser gets the HTML of the recovery letter and its subject in a header.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.post(
            url="/password-recovery-html-content/someone@example.com", headers=auth_headers(superuser)
        )
        assert response.status_code == 200
        assert response.headers["subject"] == "Test Project - Password recovery for user someone@example.com"
        assert "reset-password?token=" in response.text

    async def test_regular_user_is_forbidden(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A user who is not a superuser gets 403.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/password-recovery-html-content/someone@example.com", headers=auth_headers(user)
        )
        assert response.status_code == 403
