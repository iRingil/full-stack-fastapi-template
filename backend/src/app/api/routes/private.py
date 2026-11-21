"""Module for private endpoints."""

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi_utils.cbv import cbv

from app.api.deps import EmailManagerDep, UserCrudDep
from app.models import User, UserCreate, UserPublic

__all__: tuple[str, ...] = ("private_router",)


private_router: APIRouter = APIRouter()


@cbv(router=private_router)
class PrivateRouter:
    """Class-based view for private endpoints."""

    def __init__(self, user_crud: UserCrudDep, email_manager: EmailManagerDep) -> None:
        """
        Initializes the PrivateRouter class with the necessary dependencies.

        :param user_crud: Dependency for user CRUD operations.
        :param email_manager: Dependency for email management operations.
        """
        self._user_crud: UserCrudDep = user_crud
        self._email_manager: EmailManagerDep = email_manager

    @private_router.post(
        path="/users/",
        response_model=UserPublic,
        summary="Create User",
        status_code=status.HTTP_201_CREATED,
        description="Create new user and send a welcome email.",
    )
    async def create_user(self, user_in: UserCreate, background_tasks: BackgroundTasks) -> User:
        """
        Create new user and send a welcome email.

        :param user_in: The data for the user to be created.
        :param background_tasks: The background tasks service.
        :return: The newly created user.
        :raises HTTPException: If the user with the given email address already exists in the system.
        """
        existing_user: User | None = await self._user_crud.get_by_email(email=user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="The user with this email already exists in the system."
            )
        user: User = await self._user_crud.create(obj_in=user_in)
        if not user.is_email_verified:
            background_tasks.add_task(
                self._email_manager.send_welcome_email, email_to=user.email, username=user.full_name or user.email
            )
        return user
