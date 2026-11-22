"""
Tests for src/app/api/routes/users.py: the user's own account and the superuser's user management.

The requests go to the real application over the test database; letters are recorded by the outbox fixture.
"""

# ruff: noqa: PLR2004, S101, S106

from email.message import EmailMessage
from uuid import uuid4

from httpx import AsyncClient, Response
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.user import UserCRUD
from app.models import Item, User
from tests.conftest import USER_PASSWORD, AuthHeaders, ItemFactory, UserFactory, html_of

__all__: tuple[str, ...] = ()


async def _count(session: AsyncSession, model: type[User | Item]) -> int:
    """
    Counts the rows of a table.

    :param session: The test session.
    :param model: The table model.
    :return: The number of rows.
    """
    return (await session.exec(statement=select(func.count()).select_from(model))).one()


class TestReadUsers:
    """Tests for GET /users/."""

    async def test_superuser_gets_a_page(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser gets a page of users and the total count.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        await create_user(email="one@example.com")
        await create_user(email="two@example.com")
        response: Response = await client.get(url="/users/", params={"limit": 2}, headers=auth_headers(superuser))
        assert response.status_code == 200
        page: dict[str, object] = response.json()
        assert page["count"] == 3
        data: object = page["data"]
        assert isinstance(data, list)
        assert len(data) == 2

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
        response: Response = await client.get(url="/users/", headers=auth_headers(user))
        assert response.status_code == 403


class TestCreateUser:
    """Tests for POST /users/."""

    async def test_creates_a_user_and_sends_a_welcome_letter(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, outbox: list[EmailMessage]
    ) -> None:
        """
        A superuser creates a user; the user gets a welcome letter without the password.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        response: Response = await client.post(
            url="/users/",
            json={"email": "new@example.com", "password": "new-user-password"},
            headers=auth_headers(superuser),
        )
        assert response.status_code == 201
        assert response.json()["is_email_verified"] is False
        assert [letter["To"] for letter in outbox] == ["new@example.com"]
        html: str = html_of(letter=outbox[0])
        assert "verify-email?token=" in html
        assert "new-user-password" not in html

    async def test_no_letter_for_a_verified_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, outbox: list[EmailMessage]
    ) -> None:
        """
        A user created with a verified email gets no welcome letter.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        response: Response = await client.post(
            url="/users/",
            json={"email": "new@example.com", "password": "new-user-password", "is_email_verified": True},
            headers=auth_headers(superuser),
        )
        assert response.status_code == 201
        assert outbox == []

    async def test_existing_email(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        An email that is already taken gives 400.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        response: Response = await client.post(
            url="/users/",
            json={"email": "admin@example.com", "password": "new-user-password"},
            headers=auth_headers(superuser),
        )
        assert response.status_code == 400


class TestMe:
    """Tests for GET, PATCH and DELETE /users/me."""

    async def test_reads_the_current_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        The current user gets their own data without the password hash.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.get(url="/users/me", headers=auth_headers(user))
        assert response.status_code == 200
        assert response.json()["id"] == str(user.id)
        assert "hashed_password" not in response.json()

    async def test_updates_the_name_keeping_the_verification(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: AuthHeaders,
        outbox: list[EmailMessage],
    ) -> None:
        """
        Changing only the name keeps the email verified and sends nothing.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        user: User = await create_user(is_email_verified=True)
        response: Response = await client.patch(
            url="/users/me", json={"full_name": "New Name"}, headers=auth_headers(user)
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "New Name"
        assert response.json()["is_email_verified"] is True
        assert outbox == []

    async def test_a_new_email_becomes_unverified(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: AuthHeaders,
        outbox: list[EmailMessage],
    ) -> None:
        """
        A changed email becomes unverified, and a verification letter goes to the new address.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        user: User = await create_user(is_email_verified=True)
        response: Response = await client.patch(
            url="/users/me", json={"email": "new@example.com"}, headers=auth_headers(user)
        )
        assert response.status_code == 200
        assert response.json()["email"] == "new@example.com"
        assert response.json()["is_email_verified"] is False
        assert [letter["To"] for letter in outbox] == ["new@example.com"]

    async def test_the_same_email_is_not_a_change(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: AuthHeaders,
        outbox: list[EmailMessage],
    ) -> None:
        """
        Sending the current email again changes nothing.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param outbox: The letters sent during the test.
        :return: None
        """
        user: User = await create_user(is_email_verified=True)
        response: Response = await client.patch(url="/users/me", json={"email": user.email}, headers=auth_headers(user))
        assert response.status_code == 200
        assert response.json()["is_email_verified"] is True
        assert outbox == []

    async def test_an_email_of_another_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        The email of another user gives 409.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        await create_user(email="taken@example.com")
        response: Response = await client.patch(
            url="/users/me", json={"email": "taken@example.com"}, headers=auth_headers(user)
        )
        assert response.status_code == 409

    async def test_deletes_the_user_with_the_items(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        create_item: ItemFactory,
        auth_headers: AuthHeaders,
        session: AsyncSession,
    ) -> None:
        """
        A user deletes their account; their items go in the same transaction, other users' items stay.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param session: The test session.
        :return: None
        """
        user: User = await create_user()
        other: User = await create_user(email="other@example.com")
        await create_item(owner=user)
        await create_item(owner=user)
        await create_item(owner=other)
        response: Response = await client.delete(url="/users/me", headers=auth_headers(user))
        assert response.status_code == 200
        assert await _count(session=session, model=User) == 1
        assert await _count(session=session, model=Item) == 1

    async def test_superuser_cannot_delete_themselves(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser cannot delete their own account.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.delete(url="/users/me", headers=auth_headers(superuser))
        assert response.status_code == 403


class TestUpdatePasswordMe:
    """Tests for PATCH /users/me/password."""

    async def test_changes_the_password(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: AuthHeaders,
        session: AsyncSession,
        user_crud: UserCRUD,
    ) -> None:
        """
        The right current password lets the user set a new one.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param session: The test session.
        :param user_crud: The UserCRUD over the test session.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.patch(
            url="/users/me/password",
            json={"current_password": USER_PASSWORD, "new_password": "brand-new-password"},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        await session.refresh(instance=user)
        assert await user_crud.authenticate(email=user.email, password="brand-new-password") is not None

    async def test_wrong_current_password(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A wrong current password gives 400.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.patch(
            url="/users/me/password",
            json={"current_password": "wrong-password", "new_password": "brand-new-password"},
            headers=auth_headers(user),
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Incorrect password"

    async def test_the_same_password(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        The new password cannot be the current one.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.patch(
            url="/users/me/password",
            json={"current_password": USER_PASSWORD, "new_password": USER_PASSWORD},
            headers=auth_headers(user),
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "New password cannot be the same as the current one"


class TestRegisterUser:
    """Tests for POST /users/signup."""

    async def test_registers_and_sends_a_welcome_letter(self, client: AsyncClient, outbox: list[EmailMessage]) -> None:
        """
        Anyone can register; the new user is unverified and gets a welcome letter.

        :param client: The HTTP client of the application.
        :param outbox: The letters sent during the test.
        :return: None
        """
        response: Response = await client.post(
            url="/users/signup", json={"email": "new@example.com", "password": "new-user-password"}
        )
        assert response.status_code == 201
        assert response.json()["is_email_verified"] is False
        assert response.json()["is_superuser"] is False
        assert [letter["Subject"] for letter in outbox] == ["Test Project - Welcome aboard!"]

    async def test_existing_email(self, client: AsyncClient, create_user: UserFactory) -> None:
        """
        An email that is already taken gives 400.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/users/signup", json={"email": user.email, "password": "new-user-password"}
        )
        assert response.status_code == 400


class TestReadUserById:
    """Tests for GET /users/{id}."""

    async def test_reads_oneself(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A user can read their own data by ID.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.get(url=f"/users/{user.id}", headers=auth_headers(user))
        assert response.status_code == 200
        assert response.json()["email"] == user.email

    async def test_superuser_reads_another_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser can read any user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        user: User = await create_user()
        response: Response = await client.get(url=f"/users/{user.id}", headers=auth_headers(superuser))
        assert response.status_code == 200

    async def test_regular_user_reads_another_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A regular user cannot read another user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        other: User = await create_user(email="other@example.com")
        response: Response = await client.get(url=f"/users/{other.id}", headers=auth_headers(user))
        assert response.status_code == 403

    async def test_unknown_id(self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders) -> None:
        """
        An unknown ID gives 404.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.get(url=f"/users/{uuid4()}", headers=auth_headers(user))
        assert response.status_code == 404


class TestUpdateUser:
    """Tests for PATCH /users/{id}."""

    async def test_superuser_updates_a_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser can change any field of a user, the email included.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        user: User = await create_user()
        response: Response = await client.patch(
            url=f"/users/{user.id}",
            json={"email": "changed@example.com", "is_active": False},
            headers=auth_headers(superuser),
        )
        assert response.status_code == 200
        assert response.json()["email"] == "changed@example.com"
        assert response.json()["is_active"] is False

    async def test_without_an_email(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        An update without an email skips the email check.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        user: User = await create_user()
        response: Response = await client.patch(
            url=f"/users/{user.id}", json={"full_name": "Name"}, headers=auth_headers(superuser)
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Name"

    async def test_unknown_id(self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders) -> None:
        """
        An unknown ID gives 404.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.patch(
            url=f"/users/{uuid4()}", json={"full_name": "Name"}, headers=auth_headers(superuser)
        )
        assert response.status_code == 404

    async def test_an_email_of_another_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        The email of another user gives 409.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        user: User = await create_user()
        response: Response = await client.patch(
            url=f"/users/{user.id}", json={"email": "admin@example.com"}, headers=auth_headers(superuser)
        )
        assert response.status_code == 409


class TestDeleteUser:
    """Tests for DELETE /users/{id}."""

    async def test_superuser_deletes_a_user_with_the_items(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        create_item: ItemFactory,
        auth_headers: AuthHeaders,
        session: AsyncSession,
    ) -> None:
        """
        A superuser deletes a user; the user's items go in the same transaction.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param session: The test session.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        user: User = await create_user()
        await create_item(owner=user)
        response: Response = await client.delete(url=f"/users/{user.id}", headers=auth_headers(superuser))
        assert response.status_code == 200
        assert await _count(session=session, model=User) == 1
        assert await _count(session=session, model=Item) == 0

    async def test_unknown_id(self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders) -> None:
        """
        An unknown ID gives 404.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.delete(url=f"/users/{uuid4()}", headers=auth_headers(superuser))
        assert response.status_code == 404

    async def test_superuser_cannot_delete_themselves(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser cannot delete their own account by ID.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        response: Response = await client.delete(url=f"/users/{superuser.id}", headers=auth_headers(superuser))
        assert response.status_code == 403
