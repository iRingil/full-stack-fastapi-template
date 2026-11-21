"""Tests for src/app/api/routes/utils.py: the health check and the test email endpoint."""

# ruff: noqa: PLR2004, S101

from collections.abc import Callable
from email.message import EmailMessage

from httpx import AsyncClient, Response

from app.models import User
from tests.conftest import UserFactory

__all__: tuple[str, ...] = ()


class TestHealthCheck:
    """Tests for GET /utils/health-check/."""

    async def test_answers_ok(self, client: AsyncClient) -> None:
        """
        The health check answers without authentication.

        :param client: The HTTP client of the application.
        :return: None
        """
        response: Response = await client.get(url="/utils/health-check/")
        assert response.status_code == 200
        assert response.json() == {"message": "Ok"}


class TestTestEmail:
    """Tests for POST /utils/test-email/."""

    async def test_superuser_sends_a_test_email(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: Callable[[User], dict[str, str]],
        outbox: list[EmailMessage],
    ) -> None:
        """
        A superuser gets 202, and the test email goes to the given address.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.post(
            url="/utils/test-email/", params={"email_to": "to@example.com"}, headers=auth_headers(superuser)
        )
        assert response.status_code == 202
        assert response.json() == {"message": "Test email sent"}
        assert [(letter["To"], letter["Subject"]) for letter in outbox] == [
            ("to@example.com", "Test Project - Test email")
        ]

    async def test_regular_user_is_forbidden(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: Callable[[User], dict[str, str]]
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
            url="/utils/test-email/", params={"email_to": "to@example.com"}, headers=auth_headers(user)
        )
        assert response.status_code == 403
