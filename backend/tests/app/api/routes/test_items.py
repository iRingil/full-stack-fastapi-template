"""
Tests for src/app/api/routes/items.py: items of their owners, all items for superusers, nothing for anonymous users.

The requests go to the real application over the test database.
"""

# ruff: noqa: PLR2004, S101

from typing import TYPE_CHECKING
from uuid import uuid4

from httpx import AsyncClient, Response

from tests.conftest import AuthHeaders, ItemFactory, UserFactory

if TYPE_CHECKING:
    from app.models import Item, User

__all__: tuple[str, ...] = ()


class TestReadItems:
    """Tests for GET /items/."""

    async def test_anonymous_user_gets_an_empty_list(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory
    ) -> None:
        """
        An anonymous user gets an empty list even when there are items.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :return: None
        """
        await create_item(owner=await create_user())
        response: Response = await client.get(url="/items/")
        assert response.status_code == 200
        assert response.json() == {"data": [], "count": 0}

    async def test_user_gets_only_own_items(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A regular user gets only their own items.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        own: Item = await create_item(owner=user, title="Own")
        await create_item(owner=await create_user(email="other@example.com"), title="Other")
        response: Response = await client.get(url="/items/", headers=auth_headers(user))
        assert response.json()["count"] == 1
        assert [item["id"] for item in response.json()["data"]] == [str(own.id)]

    async def test_superuser_gets_all_items(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser gets the items of all users.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        await create_item(owner=await create_user())
        await create_item(owner=superuser)
        response: Response = await client.get(url="/items/", headers=auth_headers(superuser))
        assert response.json()["count"] == 2

    async def test_invalid_token_counts_as_anonymous(self, client: AsyncClient) -> None:
        """
        On this optional-authentication route an invalid token is treated as no token.

        :param client: The HTTP client of the application.
        :return: None
        """
        response: Response = await client.get(url="/items/", headers={"Authorization": "Bearer garbage"})
        assert response.status_code == 200
        assert response.json() == {"data": [], "count": 0}


class TestCreateItem:
    """Tests for POST /items/."""

    async def test_creates_an_own_item(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A user creates an item owned by them.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        response: Response = await client.post(
            url="/items/", json={"title": "New", "description": "Text"}, headers=auth_headers(user)
        )
        assert response.status_code == 201
        assert response.json()["owner_id"] == str(user.id)
        assert response.json()["title"] == "New"

    async def test_anonymous_user(self, client: AsyncClient) -> None:
        """
        An anonymous user gets 401.

        :param client: The HTTP client of the application.
        :return: None
        """
        response: Response = await client.post(url="/items/", json={"title": "New"})
        assert response.status_code == 401


class TestItemById:
    """Tests for GET, PUT and DELETE /items/{id}: the shared permission checks and the operations."""

    async def test_owner_reads_updates_and_deletes(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        The owner can read, partially update and delete their item.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user()
        item: Item = await create_item(owner=user, title="Old", description="Kept")
        headers: dict[str, str] = auth_headers(user)
        read: Response = await client.get(url=f"/items/{item.id}", headers=headers)
        assert read.json()["title"] == "Old"
        updated: Response = await client.put(url=f"/items/{item.id}", json={"title": "New"}, headers=headers)
        assert updated.json()["title"] == "New"
        assert updated.json()["description"] == "Kept"
        deleted: Response = await client.delete(url=f"/items/{item.id}", headers=headers)
        assert deleted.json() == {"message": "Item deleted successfully"}
        gone: Response = await client.get(url=f"/items/{item.id}", headers=headers)
        assert gone.status_code == 404

    async def test_superuser_reads_any_item(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A superuser can read an item of another user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        superuser: User = await create_user(email="admin@example.com", is_superuser=True)
        item: Item = await create_item(owner=await create_user())
        response: Response = await client.get(url=f"/items/{item.id}", headers=auth_headers(superuser))
        assert response.status_code == 200

    async def test_another_user_is_forbidden(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        A regular user cannot touch an item of another user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        item: Item = await create_item(owner=await create_user())
        stranger: User = await create_user(email="stranger@example.com")
        response: Response = await client.delete(url=f"/items/{item.id}", headers=auth_headers(stranger))
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
        response: Response = await client.get(url=f"/items/{uuid4()}", headers=auth_headers(user))
        assert response.status_code == 404

    async def test_anonymous_user(
        self, client: AsyncClient, create_user: UserFactory, create_item: ItemFactory
    ) -> None:
        """
        An anonymous user gets 401.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param create_item: The item factory.
        :return: None
        """
        item: Item = await create_item(owner=await create_user())
        response: Response = await client.get(url=f"/items/{item.id}")
        assert response.status_code == 401
