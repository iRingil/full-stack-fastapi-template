"""Tests for src/app/api/routes/private.py: creating users without authentication in the local environment."""

# ruff: noqa: PLR2004, S101

from email.message import EmailMessage
from typing import TYPE_CHECKING

from httpx import AsyncClient, Response

from tests.conftest import UserFactory

if TYPE_CHECKING:
    from app.models import User

__all__: tuple[str, ...] = ()


class TestCreateUser:
    """Tests for POST /private/users/."""

    async def test_creates_a_user_and_sends_a_welcome_letter(
        self, client: AsyncClient, outbox: list[EmailMessage]
    ) -> None:
        """
        A user is created without authentication and gets a welcome letter.

        :param client: The HTTP client of the application.
        :param outbox: The letters sent during the test.
        :return: None
        """
        response: Response = await client.post(
            url="/private/users/", json={"email": "new@example.com", "password": "new-user-password"}
        )
        assert response.status_code == 201
        assert response.json()["email"] == "new@example.com"
        assert [letter["Subject"] for letter in outbox] == ["Test Project - Welcome aboard!"]

    async def test_no_letter_for_a_verified_user(self, client: AsyncClient, outbox: list[EmailMessage]) -> None:
        """
        A user created with a verified email gets no welcome letter.

        :param client: The HTTP client of the application.
        :param outbox: The letters sent during the test.
        :return: None
        """
        response: Response = await client.post(
            url="/private/users/",
            json={"email": "new@example.com", "password": "new-user-password", "is_email_verified": True},
        )
        assert response.status_code == 201
        assert outbox == []

    async def test_existing_email(self, client: AsyncClient, create_user: UserFactory) -> None:
        """
        An email that is already taken gives 400.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/private/users/", json={"email": user.email, "password": "new-user-password"}
        )
        assert response.status_code == 400
