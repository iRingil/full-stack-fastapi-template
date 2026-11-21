"""Module for CRUD operations for Item model."""

from uuid import UUID

from sqlmodel import col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base import BaseCRUD
from app.models import Item, ItemCreate, ItemPublic, ItemsPublic, ItemUpdate

__all__: tuple[str, ...] = ("ItemCRUD",)


class ItemCRUD(BaseCRUD[Item, ItemCreate, ItemUpdate, ItemPublic, ItemsPublic]):
    """CRUD operations for Item model: owner-specific queries on top of the BaseCRUD implementation."""

    def __init__(self, *, session: AsyncSession) -> None:
        """
        Initializes the ItemCRUD.

        :param session: An asynchronous session to perform database operations.
        """
        super().__init__(session=session, model=Item, public_schema=ItemPublic, public_list_schema=ItemsPublic)

    async def create_with_owner(self, *, item_in: ItemCreate, owner_id: UUID) -> Item:
        """
        Creates a new item and assigns it to an owner.

        :param item_in: Data required to create a new item.
        :param owner_id: UUID of the user who will own the item.
        :return: The created Item object with the owner assigned.
        """
        return await self.create(obj_in=item_in, update={"owner_id": owner_id})

    async def get_multi_by_owner(self, *, owner_id: UUID, skip: int = 0, limit: int = 100) -> ItemsPublic:
        """
        Retrieve a page of items of one owner and their total count.

        :param owner_id: The UUID of the user who owns the items.
        :param skip: The number of items to skip from the start of the query.
        :param limit: The maximum number of items to return.
        :return: An ItemsPublic object containing a list of items and the total count of items.
        """
        return await self._execute_paginated_select(where=[col(Item.owner_id) == owner_id], skip=skip, limit=limit)
