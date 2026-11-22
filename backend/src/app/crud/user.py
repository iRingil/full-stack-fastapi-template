"""Module for User CRUD operations for User model."""

from collections.abc import Mapping
from typing import override

from pydantic import EmailStr
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import SecurityManager, get_security_manager
from app.crud.base import BaseCRUD
from app.models import User, UserCreate, UserPublic, UsersPublic, UserUpdate

__all__: tuple[str, ...] = ("UserCRUD",)


class UserCRUD(BaseCRUD[User, UserCreate, UserUpdate, UserPublic, UsersPublic]):
    """CRUD operations for User model: hashes passwords on top of the BaseCRUD implementation."""

    def __init__(self, *, session: AsyncSession, security_manager: SecurityManager | None = None) -> None:
        """
        Initializes the UserCRUD.

        :param session: An asynchronous session to perform database operations.
        :param security_manager: The security manager for password hashing; the application one by default.
        """
        super().__init__(session=session, model=User, public_schema=UserPublic, public_list_schema=UsersPublic)
        self._security: SecurityManager = security_manager or get_security_manager()

    @override
    async def create(self, *, obj_in: UserCreate, update: Mapping[str, object] | None = None) -> User:
        """
        Creates a new user, hashing the password before saving.

        :param obj_in: User creation data with a plain password.
        :param update: Extra values that are not part of the schema.
        :return: Created User object.
        """
        hashed_password: str = self._security.get_password_hash(password=obj_in.password)
        return await super().create(obj_in=obj_in, update={**(update or {}), "hashed_password": hashed_password})

    @override
    async def update(self, *, db_obj: User, obj_in: UserUpdate, update: Mapping[str, object] | None = None) -> User:
        """
        Updates an existing user; a new password is hashed before saving.

        :param db_obj: User object to update.
        :param obj_in: User update data.
        :param update: Extra values that are not part of the schema.
        :return: Updated User object.
        """
        extra_data: dict[str, object] = dict(update or {})
        if obj_in.password:
            extra_data["hashed_password"] = self._security.get_password_hash(password=obj_in.password)
            # A new password ends every session and outdates the password reset links sent before
            extra_data["token_version"] = db_obj.token_version + 1
        # The plain password must never reach the model
        user_data: dict[str, object] = obj_in.model_dump(exclude_unset=True, exclude={"password"})
        db_obj.sqlmodel_update(obj=user_data, update=extra_data)
        self._session.add(instance=db_obj)
        await self._session.commit()
        await self._session.refresh(instance=db_obj)
        return db_obj

    async def get_by_email(self, *, email: str | EmailStr) -> User | None:
        """
        Retrieve a user by email (emails are stored in lower case).

        :param email: User's email address, in any case.
        :return: User object or None if not found.
        """
        result = await self._session.exec(statement=select(User).where(User.email == email.lower()))
        return result.first()

    async def revoke_tokens(self, *, db_obj: User) -> User:
        """
        Revokes every access and password reset token of a user: a logout from all devices.

        :param db_obj: The user.
        :return: The updated user.
        """
        return await self.update(db_obj=db_obj, obj_in=UserUpdate(), update={"token_version": db_obj.token_version + 1})

    async def authenticate(self, *, email: str | EmailStr, password: str) -> User | None:
        """
        Authenticate a user by email and password.

        :param email: User's email address.
        :param password: User's password.
        :return: Authenticated User object or None if authentication fails.
        """
        db_user: User | None = await self.get_by_email(email=email)
        if not db_user:
            # The same time as for a wrong password, so that the answer does not reveal registered addresses
            self._security.verify_dummy_password(plain_password=password)
            return None
        if not self._security.verify_password(plain_password=password, hashed_password=db_user.hashed_password):
            return None
        return db_user
