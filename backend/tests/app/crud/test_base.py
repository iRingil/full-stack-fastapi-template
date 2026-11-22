"""
Tests for src/app/crud/base.py (BaseCRUD) against the test database.

The generic methods are exercised on a table of the tests' own, test_tag, with a composite primary key: User and
Item have single keys, and their Create schemas do not map to columns one-to-one (bulk inserts need that).
The table is part of SQLModel.metadata, so the db_manager fixture creates and drops it with the others.
"""

# ruff: noqa: PLR2004, S101

from typing import ClassVar

import pytest
from pydantic import BaseModel, ConfigDict
from sqlmodel import Field, SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base import BaseCRUD

__all__: tuple[str, ...] = ()


class TagCreate(SQLModel):
    """
    The fields of a tag.

    :param group: The first part of the key.
    :param name: The second part of the key.
    :param label: A plain field.
    """

    group: str = Field(primary_key=True, max_length=50)
    name: str = Field(primary_key=True, max_length=50)
    label: str = Field(default="", max_length=50)


class TagUpdate(SQLModel):
    """
    A partial update of a tag.

    :param label: A plain field.
    """

    label: str | None = None


class Tag(TagCreate, table=True):
    """A table of the tests: a composite primary key and a plain field."""

    __tablename__: ClassVar[str] = "test_tag"  # pyright: ignore[reportIncompatibleVariableOverride] - SQLModel declares it as a declared_attr


class TagPublic(BaseModel):
    """
    The public schema of a tag.

    :param group: The first part of the key.
    :param name: The second part of the key.
    :param label: A plain field.
    """

    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    group: str
    name: str
    label: str


class TagsPublic(BaseModel):
    """
    A page of tags.

    :param data: The tags of the page.
    :param count: The total number of tags.
    """

    data: list[TagPublic]
    count: int


class TagCRUD(BaseCRUD[Tag, TagCreate, TagUpdate, TagPublic, TagsPublic]):
    """BaseCRUD over the test table, without any additions."""

    def __init__(self, *, session: AsyncSession) -> None:
        """
        Initializes the CRUD.

        :param session: The test session.
        """
        super().__init__(session=session, model=Tag, public_schema=TagPublic, public_list_schema=TagsPublic)


def _tags(*names: str, group: str = "g") -> list[TagCreate]:
    """
    Builds tags of one group.

    :param names: The names of the tags.
    :param group: The group of the tags.
    :return: The TagCreate schemas.
    """
    return [TagCreate(group=group, name=name, label=name.upper()) for name in names]


@pytest.fixture(name="tag_crud")
def tag_crud_fixture(session: AsyncSession) -> TagCRUD:
    """
    A TagCRUD over the test session, with the tables in place.

    :param session: The test session (the db_manager fixture behind it creates the tables).
    :return: The CRUD.
    """
    return TagCRUD(session=session)


class TestCreateMulti:
    """Tests for create_multi and batch_insert."""

    async def test_creates_and_skips_the_existing(self, tag_crud: TagCRUD) -> None:
        """
        Only the new tags are created and returned; the ones that conflict on the key are skipped.

        :param tag_crud: The CRUD.
        :return: None
        """
        assert [tag.name for tag in await tag_crud.create_multi(objs_in=_tags("a", "b"))] == ["a", "b"]
        created: list[TagPublic] = await tag_crud.create_multi(objs_in=_tags("b", "c"))
        assert [(tag.name, tag.label) for tag in created] == [("c", "C")]

    async def test_all_existing(self, tag_crud: TagCRUD) -> None:
        """
        When every tag already exists, nothing is returned.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a"))
        assert await tag_crud.create_multi(objs_in=_tags("a")) == []

    async def test_conflicts_on_other_columns(self, tag_crud: TagCRUD) -> None:
        """
        index_elements chooses the columns of the conflict check; they need a unique index, the key has one.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a"))
        assert await tag_crud.create_multi(objs_in=_tags("a"), index_elements=["group", "name"]) == []

    async def test_nothing_to_create(self, tag_crud: TagCRUD) -> None:
        """
        An empty list does not touch the database.

        :param tag_crud: The CRUD.
        :return: None
        """
        assert await tag_crud.create_multi(objs_in=[]) == []

    async def test_batch_insert_counts_the_created(self, tag_crud: TagCRUD) -> None:
        """
        batch_insert splits the list into batches and counts only the newly created tags.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a"))
        assert await tag_crud.batch_insert(objs_in=_tags("a", "b", "c", "d", "e"), batch_size=2) == 4
        assert (await tag_crud.get_multi()).count == 5


class TestRead:
    """Tests for get_by_id and get_multi."""

    async def test_get_by_composite_id(self, tag_crud: TagCRUD) -> None:
        """
        A composite key is passed as a tuple.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a"))
        tag: Tag | None = await tag_crud.get_by_id(obj_id=("g", "a"))
        assert tag is not None
        assert tag.label == "A"
        assert await tag_crud.get_by_id(obj_id=("g", "missing")) is None

    async def test_pages_with_the_total(self, tag_crud: TagCRUD) -> None:
        """
        A page holds at most limit tags, and the count is the total.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a", "b", "c"))
        page: TagsPublic = await tag_crud.get_multi(skip=1, limit=1)
        assert len(page.data) == 1
        assert page.count == 3

    async def test_pages_follow_the_primary_key_order(self, tag_crud: TagCRUD) -> None:
        """
        The rows are ordered by the primary key, so the pages neither repeat nor skip rows.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("d", "b", "e", "a", "c"))
        names: list[str] = [
            tag.name for skip in (0, 2, 4) for tag in (await tag_crud.get_multi(skip=skip, limit=2)).data
        ]
        assert names == ["a", "b", "c", "d", "e"]

    async def test_page_past_the_end_keeps_the_total(self, tag_crud: TagCRUD) -> None:
        """
        A page past the end is empty but still reports the total.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a", "b"))
        page: TagsPublic = await tag_crud.get_multi(skip=10, limit=5)
        assert page.data == []
        assert page.count == 2

    async def test_empty_table(self, tag_crud: TagCRUD) -> None:
        """
        An empty table gives an empty first page.

        :param tag_crud: The CRUD.
        :return: None
        """
        assert await tag_crud.get_multi() == TagsPublic(data=[], count=0)


class TestCreateAndUpdate:
    """Tests for create and update."""

    async def test_create_with_extra_values(self, tag_crud: TagCRUD) -> None:
        """
        Extra values complete or override the schema.

        :param tag_crud: The CRUD.
        :return: None
        """
        tag: Tag = await tag_crud.create(obj_in=TagCreate(group="g", name="a"), update={"label": "Extra"})
        assert tag.label == "Extra"

    async def test_update_changes_only_the_set_fields(self, tag_crud: TagCRUD) -> None:
        """
        An update without fields changes nothing; extra values are applied.

        :param tag_crud: The CRUD.
        :return: None
        """
        tag: Tag = await tag_crud.create(obj_in=TagCreate(group="g", name="a", label="Kept"))
        assert (await tag_crud.update(db_obj=tag, obj_in=TagUpdate())).label == "Kept"
        assert (await tag_crud.update(db_obj=tag, obj_in=TagUpdate(label="New"))).label == "New"
        assert (await tag_crud.update(db_obj=tag, obj_in=TagUpdate(), update={"label": "Extra"})).label == "Extra"


class TestDelete:
    """Tests for delete and delete_multi."""

    async def test_delete_by_id(self, tag_crud: TagCRUD) -> None:
        """
        Delete returns the public schema of the deleted tag, or None for an unknown key.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a", "b"))
        deleted: TagPublic | None = await tag_crud.delete(obj_id=("g", "a"))
        assert deleted == TagPublic(group="g", name="a", label="A")
        assert await tag_crud.delete(obj_id=("g", "a")) is None
        assert (await tag_crud.get_multi()).count == 1

    async def test_delete_multi(self, tag_crud: TagCRUD) -> None:
        """
        delete_multi deletes the given tags in one transaction and returns them.

        :param tag_crud: The CRUD.
        :return: None
        """
        await tag_crud.create_multi(objs_in=_tags("a", "b", "c"))
        first: Tag | None = await tag_crud.get_by_id(obj_id=("g", "a"))
        last: Tag | None = await tag_crud.get_by_id(obj_id=("g", "c"))
        assert first is not None
        assert last is not None
        tags: list[Tag] = [first, last]
        deleted: list[TagPublic] = await tag_crud.delete_multi(objs_in=tags)
        assert [tag.name for tag in deleted] == ["a", "c"]
        assert [tag.name for tag in (await tag_crud.get_multi()).data] == ["b"]
