"""Module for users endpoints."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, status
from fastapi_utils.cbv import cbv

from app.api.deps import CurrentSuperuser, CurrentUser, EmailManagerDep, SecurityManagerDep, UserCrudDep
from app.models import (
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UserUpdate,
    UserUpdateMe,
    UsersPublic,
)

__all__: tuple[str, ...] = ("users_router",)

UserIdDep = Annotated[UUID, Path(alias="id", description="User ID")]

users_router: APIRouter = APIRouter()


@cbv(router=users_router)
class UsersRouter:
    """Class-based view for user endpoints."""

    def __init__(self, user_crud: UserCrudDep) -> None:
        """
        Initializes the UsersRouter class with the necessary dependencies.

        :param user_crud: Dependency for user CRUD operations.
        """
        self._user_crud: UserCrudDep = user_crud

    @users_router.get(
        path="/",
        response_model=UsersPublic,
        summary="Read Users",
        description="Obtaining a list of users (for superusers only).",
    )
    async def read_users(self, _: CurrentSuperuser, skip: int = 0, limit: int = 100) -> Any:
        """
        Endpoint to retrieve a list of users. Requires superuser privileges.

        :param _: The current superuser dependency to enforce permissions.
        :param skip: The number of users to skip.
        :param limit: The maximum number of users to return.
        :return: A list of users.
        """
        return await self._user_crud.get_multi(skip=skip, limit=limit)

    @users_router.post(
        path="/",
        response_model=UserPublic,
        status_code=status.HTTP_201_CREATED,
        summary="Create User",
        description="Creating a new user (for superusers only).",
    )
    async def create_user(
        self,
        user_in: UserCreate,
        email_manager: EmailManagerDep,
        background_tasks: BackgroundTasks,
        _: CurrentSuperuser,
    ) -> User:
        """
        Endpoint to create a new user and send a welcome email. Requires superuser privileges.

        The password is not sent by email: the superuser passes it to the user personally.

        :param user_in: The data for the user to be created.
        :param email_manager: The email manager dependency.
        :param background_tasks: The background tasks service.
        :param _: The current superuser dependency to enforce permissions.
        :return: The newly created user.
        :raises HTTPException: If the user with the given email address already exists in the system.
        """
        user: User | None = await self._user_crud.get_by_email(email=user_in.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="The user with this email already exists in the system."
            )
        new_user: User = await self._user_crud.create(obj_in=user_in)
        if not new_user.is_email_verified:
            background_tasks.add_task(
                email_manager.send_welcome_email, email_to=new_user.email, username=new_user.full_name or new_user.email
            )
        return new_user

    @users_router.get(
        path="/me", response_model=UserPublic, summary="Read Current User", description="Retrieving current user data."
    )
    async def read_user_me(self, current_user: CurrentUser) -> User:
        """
        Endpoint to get the current user's data.

        :param current_user: The currently authenticated user.
        :return: The current user's data.
        """
        return current_user

    @users_router.patch(
        path="/me",
        response_model=UserPublic,
        summary="Update Current User",
        description="Updating the current user's data.",
    )
    async def update_user_me(
        self,
        user_in: UserUpdateMe,
        current_user: CurrentUser,
        background_tasks: BackgroundTasks,
        email_manager: EmailManagerDep,
    ) -> User:
        """
        Endpoint for the current user to update their own data.

        A changed email address becomes unverified, and a verification email is sent to it.

        :param user_in: The new data for the user.
        :param current_user: The currently authenticated user.
        :param background_tasks: The background tasks service.
        :param email_manager: The email manager dependency.
        :return: The updated user data.
        :raises HTTPException: If the user with the given email address already exists in the system.
        """
        email_changed: bool = bool(user_in.email) and user_in.email != current_user.email
        if email_changed:
            existing_user: User | None = await self._user_crud.get_by_email(email=str(user_in.email))
            if existing_user and existing_user.id != current_user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")
        user: User = await self._user_crud.update(
            db_obj=current_user,
            obj_in=UserUpdate.model_validate(obj=user_in.model_dump(exclude_unset=True)),
            update={"is_email_verified": False} if email_changed else None,
        )
        if email_changed:
            background_tasks.add_task(
                email_manager.send_verification_email, email_to=user.email, username=user.full_name or user.email
            )
        return user

    @users_router.patch(
        path="/me/password",
        response_model=Message,
        summary="Update Current User's Password",
        description="Update the current user's password.",
    )
    async def update_password_me(
        self, body: UpdatePassword, current_user: CurrentUser, security_manager: SecurityManagerDep
    ) -> Message:
        """
        Endpoint for the current user to update their own password.

        :param body: The request body containing current and new passwords.
        :param current_user: The currently authenticated user.
        :param security_manager: The security manager dependency.
        :return: A confirmation message.
        :raises HTTPException: If the current password is incorrect or the new password is the same as the current one.
        """
        if not security_manager.verify_password(
            plain_password=body.current_password, hashed_password=current_user.hashed_password
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password")
        if body.current_password == body.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="New password cannot be the same as the current one"
            )
        await self._user_crud.update(db_obj=current_user, obj_in=UserUpdate(password=body.new_password))
        return Message(message="Password updated successfully")

    @users_router.delete(
        path="/me", response_model=Message, summary="Delete Current User", description="Delete current user."
    )
    async def delete_user_me(self, current_user: CurrentUser) -> Message:
        """
        Endpoint for the current user to delete their own account together with their items.

        :param current_user: The currently authenticated user.
        :return: A confirmation message.
        :raises HTTPException: If the current user is a superuser.
        """
        if current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Super users are not allowed to delete themselves"
            )
        await self._user_crud.delete_multi(objs_in=[current_user])
        return Message(message="User deleted successfully")

    @users_router.post(
        path="/signup",
        response_model=UserPublic,
        status_code=status.HTTP_201_CREATED,
        summary="Register New User",
        description="New user registration.",
    )
    async def register_user(
        self, user_in: UserRegister, background_tasks: BackgroundTasks, email_manager: EmailManagerDep
    ) -> User:
        """
        Endpoint for new user registration. Sends a welcome email with an email verification link.

        :param user_in: The registration data.
        :param background_tasks: The background tasks service.
        :param email_manager: The email manager dependency.
        :return: The newly created user.
        :raises HTTPException: If the user with the given email address already exists in the system.
        """
        user: User | None = await self._user_crud.get_by_email(email=user_in.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="The user with this email already exists in the system"
            )
        new_user: User = await self._user_crud.create(obj_in=UserCreate.model_validate(obj=user_in))
        background_tasks.add_task(
            email_manager.send_welcome_email, email_to=new_user.email, username=new_user.full_name or new_user.email
        )
        return new_user

    @users_router.get(
        path="/{id}", response_model=UserPublic, summary="Read User by ID", description="Retrieving user data by ID."
    )
    async def read_user_by_id(self, user_id: UserIdDep, current_user: CurrentUser) -> User:
        """
        Endpoint to retrieve a user's data by their ID.

        :param user_id: The ID of the user to retrieve.
        :param current_user: The currently authenticated user.
        :return: The requested user's data.
        :raises HTTPException: If the user with the given ID is not found.
        """
        user: User | None = await self._user_crud.get_by_id(obj_id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.id == current_user.id:
            return user
        if not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges")
        return user

    @users_router.patch(
        path="/{id}",
        response_model=UserPublic,
        summary="Update User by ID",
        description="Update user by ID (for superusers only).",
    )
    async def update_user(self, user_id: UserIdDep, user_in: UserUpdate, _: CurrentSuperuser) -> User:
        """
        Endpoint to update a user by their ID. Requires superuser privileges.

        :param user_id: The ID of the user to update.
        :param user_in: The new data for the user.
        :param _: The superuser dependency to enforce permissions.
        :return: The updated user data.
        :raises HTTPException: If the user with the given ID is not found
                               or if a user with the same email already exists.
        """
        db_user: User | None = await self._user_crud.get_by_id(obj_id=user_id)
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="The user with this id does not exist in the system"
            )
        if user_in.email:
            existing_user = await self._user_crud.get_by_email(email=user_in.email)
            if existing_user and existing_user.id != user_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")
        return await self._user_crud.update(db_obj=db_user, obj_in=user_in)

    @users_router.delete(
        path="/{id}",
        response_model=Message,
        summary="Delete User by ID",
        description="Delete a user by their ID (superusers only).",
    )
    async def delete_user(self, user_id: UserIdDep, current_superuser: CurrentSuperuser) -> Message:
        """
        Endpoint to delete a user by their ID. Requires superuser privileges.

        :param user_id: The ID of the user to delete.
        :param current_superuser: The currently authenticated superuser, used for permission checks.
        :return: A confirmation message.
        :raises HTTPException: If the user is not found or tries to delete themselves.
        """
        user_to_delete: User | None = await self._user_crud.get_by_id(obj_id=user_id)
        if not user_to_delete:
            raise HTTPException(status_code=404, detail="User not found")
        if user_to_delete.id == current_superuser.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Super users are not allowed to delete themselves"
            )
        # The ORM cascade deletes the user's items in the same transaction
        await self._user_crud.delete_multi(objs_in=[user_to_delete])
        return Message(message="User deleted successfully")
