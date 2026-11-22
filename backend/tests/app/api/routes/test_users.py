"""
Tests for src/app/api/routes/users.py: the user's own account and the superuser's user management.

The requests go to the real application over the test database; letters are recorded by the outbox fixture.
"""

# ruff: noqa: PLR2004, S101, S106

from email.message import EmailMessage
from uuid import uuid4

import pytest
from httpx import AsyncClient, Response
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.user import UserCRUD
from app.models import Item, User
from tests.conftest import USER_PASSWORD, AuthHeaders, ItemFactory, UserFactory, html_of

__all__: tuple[str, ...] = ()

_SIGNUP_ANSWER: str = (
    "If this email is not registered yet, the account has been created and a confirmation link has been sent to it."
)


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
            url="/users/me",
            json={"email": "New@Example.com", "current_password": USER_PASSWORD},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        assert response.json()["email"] == "new@example.com"
        assert response.json()["is_email_verified"] is False
        assert [letter["To"] for letter in outbox] == ["new@example.com"]

    @pytest.mark.parametrize(argnames="password", argvalues=[None, "wrong-password"], ids=["missing", "wrong"])
    async def test_a_new_email_needs_the_current_password(
        self,
        client: AsyncClient,
        create_user: UserFactory,
        auth_headers: AuthHeaders,
        session: AsyncSession,
        password: str | None,
    ) -> None:
        """
        Without the right current password the email is not changed.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param session: The test session.
        :param password: The current password sent with the request, or None to leave it out.
        :return: None
        """
        user: User = await create_user()
        body: dict[str, str] = {"email": "new@example.com"} | ({"current_password": password} if password else {})
        response: Response = await client.patch(url="/users/me", json=body, headers=auth_headers(user))
        assert response.status_code == 400
        assert response.json()["detail"] == "Incorrect password"
        await session.refresh(instance=user)
        assert user.email == "user@example.com"

    @pytest.mark.parametrize(
        argnames="body", argvalues=[{"email": None}, {"full_name": "a\x00b"}], ids=["null-email", "nul-character"]
    )
    async def test_rejects_values_the_database_cannot_store(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, body: dict[str, object]
    ) -> None:
        """
        A null email and a NUL character are validation errors, not database errors.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param body: The request body.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.patch(url="/users/me", json=body, headers=auth_headers(user))
        assert response.status_code == 422

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
            url="/users/me",
            json={"email": "taken@example.com", "current_password": USER_PASSWORD},
            headers=auth_headers(user),
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
        headers: dict[str, str] = auth_headers(user)
        response: Response = await client.patch(
            url="/users/me/password",
            json={"current_password": USER_PASSWORD, "new_password": "brand-new-password"},
            headers=headers,
        )
        assert response.status_code == 200
        await session.refresh(instance=user)
        assert await user_crud.authenticate(email=user.email, password="brand-new-password") is not None
        # The token issued before the change is revoked
        assert (await client.get(url="/users/me", headers=headers)).status_code == 401

    @pytest.mark.parametrize(
        argnames="new_password", argvalues=["Password123", "й" * 37], ids=["too-common", "over-72-bytes"]
    )
    async def test_rejects_a_weak_or_too_long_password(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, new_password: str
    ) -> None:
        """
        A common password, and one that bcrypt would have to cut (over 72 bytes in UTF-8), are validation errors.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param new_password: The password to set.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.patch(
            url="/users/me/password",
            json={"current_password": USER_PASSWORD, "new_password": new_password},
            headers=auth_headers(user),
        )
        assert response.status_code == 422

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

    async def test_registers_and_sends_a_welcome_letter(
        self, client: AsyncClient, outbox: list[EmailMessage], user_crud: UserCRUD
    ) -> None:
        """
        Anyone can register; the new user is unverified, not a superuser, and gets a welcome letter.

        :param client: The HTTP client of the application.
        :param outbox: The letters sent during the test.
        :param user_crud: The UserCRUD over the test session.
        :return: None
        """
        response: Response = await client.post(
            url="/users/signup", json={"email": "New@Example.com", "password": "new-user-password"}
        )
        assert response.status_code == 200
        assert response.json() == {"message": _SIGNUP_ANSWER}
        user: User | None = await user_crud.get_by_email(email="new@example.com")
        assert user is not None
        assert not user.is_email_verified
        assert not user.is_superuser
        assert [letter["Subject"] for letter in outbox] == ["Test Project - Welcome aboard!"]

    async def test_existing_email(
        self, client: AsyncClient, create_user: UserFactory, outbox: list[EmailMessage], user_crud: UserCRUD
    ) -> None:
        """
        A taken email (in any case) gets the same answer as a new one; the account stays as it was, nothing is sent.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param outbox: The letters sent during the test.
        :param user_crud: The UserCRUD over the test session.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/users/signup", json={"email": user.email.upper(), "password": "new-user-password"}
        )
        assert response.status_code == 200
        assert response.json() == {"message": _SIGNUP_ANSWER}
        assert outbox == []
        assert await user_crud.authenticate(email=user.email, password="new-user-password") is None

    async def test_requests_per_ip_are_limited(self, client: AsyncClient) -> None:
        """
        The sixth registration of one IP within a minute gets 429.

        :param client: The HTTP client of the application.
        :return: None
        """
        statuses: list[int] = [
            (
                await client.post(
                    url="/users/signup", json={"email": f"new{number}@example.com", "password": "new-user-password"}
                )
            ).status_code
            for number in range(6)
        ]
        assert statuses == [200] * 5 + [429]


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

    @pytest.mark.parametrize(argnames="body", argvalues=[{"is_active": False}, {"is_superuser": False}])
    async def test_superuser_cannot_deactivate_or_demote_themselves(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, body: dict[str, bool]
    ) -> None:
        """
        Superusers cannot lock themselves out of the administration; their other fields can still be changed.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param body: The request body.
        :return: None
        """
        superuser: User = await create_user(is_superuser=True)
        headers: dict[str, str] = auth_headers(superuser)
        response: Response = await client.patch(url=f"/users/{superuser.id}", json=body, headers=headers)
        assert response.status_code == 403
        renamed: Response = await client.patch(
            url=f"/users/{superuser.id}", json={"full_name": "Boss", "is_active": True}, headers=headers
        )
        assert renamed.status_code == 200

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
