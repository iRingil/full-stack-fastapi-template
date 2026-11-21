"""Generic, reusable CRUD (Create, Read, Update, Delete) base class."""

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from sqlalchemy import ColumnElement, Executable, Row, Select, inspect, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql.functions import count
from sqlmodel import SQLModel, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

__all__: tuple[str, ...] = ("BaseCRUD",)


class BaseCRUD[
    ModelType: SQLModel,
    CreateSchemaType: BaseModel,
    UpdateSchemaType: BaseModel,
    PublicSchemaType: BaseModel,
    PublicListSchemaType: BaseModel,
]:
    """
    Generic CRUD class with a default implementation of the common methods.

    Single-object methods work with 'live' ORM objects (routes need them for permission checks and partial updates);
    bulk inserts use INSERT ... RETURNING; deletion goes through the ORM so that cascades apply.
    """

    def __init__(
        self,
        *,
        session: AsyncSession,
        model: type[ModelType],
        public_schema: type[PublicSchemaType],
        public_list_schema: type[PublicListSchemaType],
    ) -> None:
        """
        Initializes the CRUD object.

        :param session: The database session to be used for all operations.
        :param model: A SQLModel table model class.
        :param public_schema: A Pydantic model for a single public object.
        :param public_list_schema: A Pydantic model for a page of public objects (fields 'data' and 'count').
        """
        self._session: AsyncSession = session
        self._model: type[ModelType] = model
        self._public_schema: type[PublicSchemaType] = public_schema
        self._public_list_schema: type[PublicListSchemaType] = public_list_schema

    # Helpers
    @property
    def _pk_names(self) -> list[str]:
        """
        Names of the primary key columns of the model.

        :return: A list of column names.
        """
        return [pk.name for pk in inspect(subject=self._model).primary_key]

    def _pk_clause(self, *, pk_values: Sequence[tuple[Any, ...]]) -> ColumnElement[bool]:
        """
        Builds a WHERE clause matching the given primary keys (composite keys are supported).

        :param pk_values: Primary key values, one tuple per object.
        :return: The WHERE clause.
        """
        return tuple_(*(getattr(self._model, name) for name in self._pk_names)).in_(pk_values)

    def _to_public(self, *, db_obj: ModelType) -> PublicSchemaType:
        """
        Converts a database object to its public schema.

        :param db_obj: The database object.
        :return: The public schema of the object.
        """
        return self._public_schema.model_validate(obj=db_obj, from_attributes=True)

    async def _commit_and_refresh_multi(self, *, stmt: Executable) -> list[ModelType]:
        """
        Executes a statement with a RETURNING clause, commits the transaction and re-reads the affected objects.

        :param stmt: The SQLAlchemy executable statement (e.g., Insert) with a returning() clause.
        :return: A list of the affected database model instances, refreshed from the database.
        """
        result = await self._session.exec(statement=stmt)  # type: ignore[call-overload]
        returned_rows: Sequence[Row[Any]] = result.all()
        if not returned_rows:
            await self._session.commit()
            return []
        pk_values: list[tuple[Any, ...]] = [
            tuple(getattr(row[0], name) for name in self._pk_names) for row in returned_rows
        ]
        await self._session.commit()
        # A SEPARATE SELECT on these PKs gives 'refreshed' objects
        fresh_result = await self._session.exec(
            statement=select(self._model).where(self._pk_clause(pk_values=pk_values))
        )
        return list(fresh_result.all())

    async def _execute_paginated_select(
        self, *, where: Sequence[ColumnElement[bool]] = (), skip: int = 0, limit: int = 100
    ) -> PublicListSchemaType:
        """
        Selects a page of objects together with the total count in a single query.

        :param where: Filter conditions.
        :param skip: The number of objects to skip.
        :param limit: The maximum number of objects to return.
        :return: A public list schema with the objects of the page and the total count.
        """
        stmt: Select[tuple[ModelType, int]] = (
            select(self._model, count().over().label(name="total_count"))  # type: ignore[call-overload]
            .where(*where)
            .offset(offset=skip)
            .limit(limit=limit)
        )
        result = await self._session.exec(statement=stmt)  # type: ignore[call-overload]
        rows: Sequence[Row[tuple[ModelType, int]]] = result.all()
        if rows:
            total: int = rows[0][1]
        elif skip:
            # A page past the end has no rows to carry the window count, so the total is counted separately
            total_result = await self._session.exec(
                statement=select(func.count()).select_from(self._model).where(*where)
            )
            total = total_result.one()
        else:
            total = 0
        items: list[PublicSchemaType] = [self._to_public(db_obj=row[0]) for row in rows]
        return self._public_list_schema(data=items, count=total)

    # Read
    async def get_by_id(self, *, obj_id: Any) -> ModelType | None:
        """
        Retrieves an object by its primary key.

        :param obj_id: The primary key of the object (a tuple for a composite key).
        :return: The database object or None if not found.
        """
        return await self._session.get(entity=self._model, ident=obj_id)

    async def get_multi(self, *, skip: int = 0, limit: int = 100) -> PublicListSchemaType:
        """
        Retrieves a page of objects and the total count.

        :param skip: The number of objects to skip.
        :param limit: The maximum number of objects to return.
        :return: A public list schema with the objects of the page and the total count.
        """
        return await self._execute_paginated_select(skip=skip, limit=limit)

    # Create
    async def create(self, *, obj_in: CreateSchemaType, update: dict[str, Any] | None = None) -> ModelType:
        """
        Creates a new object.

        :param obj_in: A Pydantic model (schema) with the creation data.
        :param update: Extra values that are not part of the schema (e.g., owner ID or password hash).
        :return: The created database object.
        """
        db_obj: ModelType = self._model.model_validate(obj=obj_in, update=update)
        self._session.add(instance=db_obj)
        await self._session.commit()
        await self._session.refresh(instance=db_obj)
        return db_obj

    async def create_multi(
        self, *, objs_in: list[CreateSchemaType], index_elements: list[str] | None = None
    ) -> list[PublicSchemaType]:
        """
        Creates multiple objects in one INSERT, ignoring the ones that conflict with existing rows.

        :param objs_in: A list of Pydantic models (schemas) with the creation data.
        :param index_elements: Columns to check for conflicts; the primary key by default.
        :return: A list of public schemas of the newly CREATED objects.
        """
        if not objs_in:
            return []
        stmt = (
            insert(table=self._model)
            .values([obj.model_dump() for obj in objs_in])
            .on_conflict_do_nothing(index_elements=index_elements or self._pk_names)
            .returning(self._model)
        )
        created_objs: list[ModelType] = await self._commit_and_refresh_multi(stmt=stmt)
        return [self._to_public(db_obj=db_obj) for db_obj in created_objs]

    async def batch_insert(self, *, objs_in: list[CreateSchemaType], batch_size: int = 1000) -> int:
        """
        Inserts a large list of objects in batches to stay within the database parameter limits.

        :param objs_in: The list of Pydantic models to insert.
        :param batch_size: The number of objects per batch.
        :return: The total number of newly created objects.
        """
        total_created: int = 0
        for i in range(0, len(objs_in), batch_size):
            created_items: list[PublicSchemaType] = await self.create_multi(objs_in=objs_in[i : i + batch_size])
            total_created += len(created_items)
        return total_created

    # Update
    async def update(
        self, *, db_obj: ModelType, obj_in: UpdateSchemaType, update: dict[str, Any] | None = None
    ) -> ModelType:
        """
        Partially updates an object: only the fields set in obj_in are changed.

        :param db_obj: The database object to update.
        :param obj_in: The update data.
        :param update: Extra values that are not part of the schema.
        :return: The updated database object.
        """
        db_obj.sqlmodel_update(obj=obj_in.model_dump(exclude_unset=True), update=update)
        self._session.add(instance=db_obj)
        await self._session.commit()
        await self._session.refresh(instance=db_obj)
        return db_obj

    # Delete
    async def delete(self, *, obj_id: Any) -> PublicSchemaType | None:
        """
        Deletes an object by its primary key through the ORM, so relationship cascades apply in the same transaction.

        :param obj_id: The primary key of the object (a tuple for a composite key).
        :return: The public schema of the deleted object, or None if it was not found.
        """
        db_obj: ModelType | None = await self.get_by_id(obj_id=obj_id)
        if not db_obj:
            return None
        deleted: list[PublicSchemaType] = await self.delete_multi(objs_in=[db_obj])
        return deleted[0]

    async def delete_multi(self, *, objs_in: Sequence[ModelType]) -> list[PublicSchemaType]:
        """
        Deletes multiple objects through the ORM in one transaction; relationship cascades apply.

        :param objs_in: The database objects to delete.
        :return: A list of public schemas of the DELETED objects.
        """
        # Convert to public schemas BEFORE the commit, while the objects are still loaded
        deleted: list[PublicSchemaType] = [self._to_public(db_obj=db_obj) for db_obj in objs_in]
        for db_obj in objs_in:
            await self._session.delete(instance=db_obj)
        await self._session.commit()
        return deleted
