"""Module for dependency injection."""

from collections.abc import AsyncGenerator
from time import monotonic
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import DatabaseManager, get_db_manager
from app.core.emails import EmailManager, get_email_manager
from app.core.security import SecurityManager, get_security_manager
from app.crud.item import ItemCRUD
from app.crud.user import UserCRUD
from app.models import User

__all__: tuple[str, ...] = (
    "CurrentSuperuser",
    "CurrentUser",
    "DbManagerDep",
    "EmailManagerDep",
    "ItemCrudDep",
    "OptionalCurrentUser",
    "ResendVerificationRateLimiter",
    "SecurityManagerDep",
    "SessionDep",
    "SettingsDep",
    "UserCrudDep",
)


# 1. Base dependencies
SettingsDep = Annotated[Settings, Depends(get_settings)]
DbManagerDep = Annotated[DatabaseManager, Depends(get_db_manager)]
SecurityManagerDep = Annotated[SecurityManager, Depends(get_security_manager)]
EmailManagerDep = Annotated[EmailManager, Depends(get_email_manager)]


# 2. Authentication schemes
_token_url: str = f"{get_settings().API_V1_STR}/login/access-token"
# Strict version for mandatory authentication
_reusable_oauth2_strict: OAuth2PasswordBearer = OAuth2PasswordBearer(tokenUrl=_token_url)
# Flexible version for optional authentication (does not crash with an error)
_reusable_oauth2_optional: OAuth2PasswordBearer = OAuth2PasswordBearer(tokenUrl=_token_url, auto_error=False)

StrictTokenDep = Annotated[str, Depends(_reusable_oauth2_strict)]
OptionalTokenDep = Annotated[str | None, Depends(_reusable_oauth2_optional)]


# 3. Derived dependencies
async def _get_session(db_manager: DbManagerDep) -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    """
    Dependency to get a database session.

    :param db_manager: Database manager dependency.
    :return: An asynchronous generator yielding a new session.
    """
    async for session in db_manager.get_session():
        yield session


SessionDep = Annotated[AsyncSession, Depends(_get_session)]


def _decode_user_id_from_token(*, token: str, settings: Settings, security_manager: SecurityManager) -> UUID:
    """
    Decodes an access token and extracts the user ID.

    :param token: The JWT access token.
    :param settings: Application settings.
    :param security_manager: Security manager instance.
    :return: The UUID of the user.
    :raises HTTPException: 401 if the token is invalid or cannot be decoded.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            jwt=token, key=settings.SECRET_KEY.get_secret_value(), algorithms=[security_manager.ALGORITHM]
        )
        return UUID(hex=payload["sub"])
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# 4. Class-based dependencies (providers)
class UserCRUDProvider:
    """Class dependency for providing UserCRUD."""

    def __call__(self, session: SessionDep, security_manager: SecurityManagerDep) -> UserCRUD:
        """
        Instantiate UserCRUD with a given session.

        :param session: An asynchronous session to perform database operations.
        :param security_manager: The security manager for password hashing.
        :return: An instance of UserCRUD.
        """
        return UserCRUD(session=session, security_manager=security_manager)


class ItemCRUDProvider:
    """Class dependency for providing ItemCRUD."""

    def __call__(self, session: SessionDep) -> ItemCRUD:
        """
        Instantiate ItemCRUD with a given session.

        :param session: An asynchronous session to perform database operations.
        :return: An instance of ItemCRUD.
        """
        return ItemCRUD(session=session)


UserCrudDep = Annotated[UserCRUD, Depends(UserCRUDProvider())]
ItemCrudDep = Annotated[ItemCRUD, Depends(ItemCRUDProvider())]


class CurrentUserProvider:
    """Class dependency for obtaining the current user (strict)."""

    async def __call__(
        self, token: StrictTokenDep, settings: SettingsDep, user_crud: UserCrudDep, security_manager: SecurityManagerDep
    ) -> User:
        """
        Retrieve the current user based on the provided JWT token.

        :param token: The JWT token extracted from the request, used for authentication (strict).
        :param settings: Settings dependency.
        :param user_crud: An instance of UserCRUD to perform user retrieval operations.
        :param security_manager: An instance of SecurityManager to handle token decoding.
        :return: The User object corresponding to the token's subject (user ID).
        :raises HTTPException: If the token is invalid, the user is not found, or the user is inactive.
        """
        user_id: UUID = _decode_user_id_from_token(token=token, settings=settings, security_manager=security_manager)
        user: User | None = await user_crud.get_by_id(obj_id=user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
        return user


class OptionalCurrentUserProvider:
    """Class dependency for optionally obtaining the current user."""

    async def __call__(
        self,
        token: OptionalTokenDep,
        settings: SettingsDep,
        user_crud: UserCrudDep,
        security_manager: SecurityManagerDep,
    ) -> User | None:
        """
        Retrieve the current user based on the provided JWT token.

        :param token: The JWT token extracted from the request, used for authentication (optional).
        :param settings: Settings dependency.
        :param user_crud: An instance of UserCRUD to perform user retrieval operations.
        :param security_manager: An instance of SecurityManager to handle token decoding.
        :return: The User object, or None if there is no valid token or the user is not found or inactive.
        """
        if not token:
            return None
        try:
            user_id: UUID = _decode_user_id_from_token(
                token=token, settings=settings, security_manager=security_manager
            )
        except HTTPException:
            return None
        user: User | None = await user_crud.get_by_id(obj_id=user_id)
        if user and not user.is_active:
            return None
        return user


class ActiveSuperuserProvider:
    """Class dependency for obtaining the currently active superuser."""

    def __call__(self, current_user: Annotated[User, Depends(CurrentUserProvider())]) -> User:
        """
        Retrieve the currently active superuser.

        :param current_user: The current user, injected by the `CurrentUserProvider`.
        :return: The User object corresponding to the current superuser.
        :raises HTTPException: If the current user is not a superuser.
        """
        if not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges")
        return current_user


class ResendVerificationRateLimiterProvider:
    """
    Limits requests for a new verification email to one per interval per client IP.

    The state lives in the memory of one worker process: with several workers a client gets one request per worker.
    Behind a reverse proxy, run uvicorn with --proxy-headers so that the client IP is not the proxy's.
    """

    def __init__(self, interval_seconds: float = 60.0) -> None:
        """
        Initializes the rate limiter.

        :param interval_seconds: The minimal interval between two requests from one IP.
        """
        self._interval_seconds: float = interval_seconds
        self._last_request_at: dict[str, float] = {}

    async def __call__(self, request: Request) -> None:
        """
        Checks whether the client's IP is rate-limited.

        :param request: The FastAPI request object to get the client's IP.
        :return: None if the request is allowed.
        :raises HTTPException: 429 if the client has already made a request within the interval.
        """
        now: float = monotonic()
        # Forget the expired entries so that the memory stays bounded
        self._last_request_at = {
            ip: moment for ip, moment in self._last_request_at.items() if now - moment < self._interval_seconds
        }
        ip_address: str = request.client.host if request.client else "unknown"
        if ip_address in self._last_request_at:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a minute before trying again.",
            )
        self._last_request_at[ip_address] = now


# 5. Final dependency aliases for use in path operations
CurrentUser = Annotated[User, Depends(CurrentUserProvider())]
CurrentSuperuser = Annotated[User, Depends(ActiveSuperuserProvider())]
OptionalCurrentUser = Annotated[User | None, Depends(OptionalCurrentUserProvider())]
ResendVerificationRateLimiter = Depends(ResendVerificationRateLimiterProvider())
