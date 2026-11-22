"""Module for dependency injection."""

from collections.abc import AsyncGenerator
from time import monotonic
from typing import TYPE_CHECKING, Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Query, Request, params, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import Settings, get_settings
from app.core.constants import API_V1_STR
from app.core.db import DatabaseManager, get_db_manager
from app.core.emails import EmailManager, get_email_manager
from app.core.security import SecurityManager, get_security_manager
from app.crud.item import ItemCRUD
from app.crud.user import UserCRUD
from app.models import User

if TYPE_CHECKING:
    from starlette.datastructures import Address

__all__: tuple[str, ...] = (
    "ALL_LIMITERS",
    "CurrentSuperuser",
    "CurrentUser",
    "DbManagerDep",
    "EmailManagerDep",
    "FailedLoginsDep",
    "ItemCrudDep",
    "LimitQuery",
    "LoginRateLimiter",
    "OptionalCurrentUser",
    "PasswordRecoveryRateLimiter",
    "RateLimiterProvider",
    "ResendVerificationRateLimiter",
    "SecurityManagerDep",
    "SessionDep",
    "SettingsDep",
    "SignupRateLimiter",
    "SkipQuery",
    "SlidingWindowLimiter",
    "UserCrudDep",
)


# 1. Base dependencies
SettingsDep = Annotated[Settings, Depends(get_settings)]
DbManagerDep = Annotated[DatabaseManager, Depends(get_db_manager)]
SecurityManagerDep = Annotated[SecurityManager, Depends(get_security_manager)]
EmailManagerDep = Annotated[EmailManager, Depends(get_email_manager)]


# 2. Authentication schemes
_token_url: str = f"{API_V1_STR}/login/access-token"
# Strict version for mandatory authentication
_reusable_oauth2_strict: OAuth2PasswordBearer = OAuth2PasswordBearer(tokenUrl=_token_url)
# Flexible version for optional authentication (does not crash with an error)
_reusable_oauth2_optional: OAuth2PasswordBearer = OAuth2PasswordBearer(tokenUrl=_token_url, auto_error=False)

StrictTokenDep = Annotated[str, Depends(_reusable_oauth2_strict)]
OptionalTokenDep = Annotated[str | None, Depends(_reusable_oauth2_optional)]


# 3. Derived dependencies
async def _get_session(db_manager: DbManagerDep) -> AsyncGenerator[AsyncSession]:
    """
    Dependency to get a database session.

    :param db_manager: Database manager dependency.
    :return: An asynchronous generator yielding a new session.
    """
    async for session in db_manager.get_session():
        yield session


SessionDep = Annotated[AsyncSession, Depends(_get_session)]


def _credentials_error() -> HTTPException:
    """
    The answer to any token that does not authenticate an active user.

    Always 401, whatever the reason (a bad or revoked token, a deleted or deactivated user): the client logs out
    on 401, and the reason is not revealed.

    :return: The exception to raise.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_access_token(*, token: str, settings: Settings, security_manager: SecurityManager) -> tuple[UUID, object]:
    """
    Decodes an access token and extracts the user ID and the token version.

    :param token: The JWT access token.
    :param settings: Application settings.
    :param security_manager: Security manager instance.
    :return: The UUID of the user and the token version claim (None if the token has none).
    :raises HTTPException: 401 if the token is invalid or cannot be decoded.
    """
    try:
        payload: dict[str, object] = jwt.decode(
            jwt=token, key=settings.security.secret_key.get_secret_value(), algorithms=[security_manager.ALGORITHM]
        )
    except InvalidTokenError as exc:
        raise _credentials_error() from exc
    subject: object = payload.get("sub")
    if not isinstance(subject, str):
        raise _credentials_error()
    try:
        return UUID(hex=subject), payload.get(security_manager.VERSION_CLAIM)
    except ValueError as exc:
        raise _credentials_error() from exc


async def _get_user_from_token(
    *, token: str, settings: Settings, user_crud: UserCRUD, security_manager: SecurityManager
) -> User:
    """
    Decodes an access token and loads its user.

    :param token: The JWT access token.
    :param settings: Application settings.
    :param user_crud: An instance of UserCRUD to load the user.
    :param security_manager: Security manager instance.
    :return: The active user the token was issued to.
    :raises HTTPException: 401 if the token is invalid or revoked, or the user is deleted or inactive.
    """
    user_id, version = _decode_access_token(token=token, settings=settings, security_manager=security_manager)
    user: User | None = await user_crud.get_by_id(obj_id=user_id)
    # A logout, a new password or a password reset raises the user's token version and so revokes the token
    if not user or not user.is_active or version != user.token_version:
        raise _credentials_error()
    return user


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
        :raises HTTPException: 401 if the token is invalid or revoked, or the user is deleted or inactive.
        """
        return await _get_user_from_token(
            token=token, settings=settings, user_crud=user_crud, security_manager=security_manager
        )


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
            return await _get_user_from_token(
                token=token, settings=settings, user_crud=user_crud, security_manager=security_manager
            )
        except HTTPException:
            return None


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


class SlidingWindowLimiter:
    """
    Counts events per key (a client IP, an account) within a sliding time window.

    The state lives in the memory of one worker process: with several workers every worker counts on its own.
    """

    def __init__(self, *, limit: int, interval_seconds: float) -> None:
        """
        Initializes the limiter.

        :param limit: How many events one key may have within the interval.
        :param interval_seconds: The length of the window.
        """
        self._limit: int = limit
        self._interval_seconds: float = interval_seconds
        self._events: dict[str, list[float]] = {}

    def _prune(self) -> None:
        """
        Forgets the events older than the window, so that the memory stays bounded.

        :return: None
        """
        oldest: float = monotonic() - self._interval_seconds
        kept: dict[str, list[float]] = {
            key: [moment for moment in moments if moment > oldest] for key, moments in self._events.items()
        }
        self._events = {key: moments for key, moments in kept.items() if moments}

    def is_exceeded(self, key: str) -> bool:
        """
        Checks whether a key has used up its limit.

        :param key: The key.
        :return: True if the key already has the allowed number of events within the window.
        """
        self._prune()
        return len(self._events.get(key, [])) >= self._limit

    def add(self, key: str) -> None:
        """
        Records an event of a key.

        :param key: The key.
        :return: None
        """
        self._events.setdefault(key, []).append(monotonic())

    def clear(self, key: str | None = None) -> None:
        """
        Forgets the events of a key, or of all the keys.

        :param key: The key; None for all.
        :return: None
        """
        if key is None:
            self._events.clear()
        else:
            self._events.pop(key, None)


class RateLimiterProvider:
    """
    Class dependency that limits the requests of a route per client IP.

    The client IP is the one Uvicorn reports: behind a reverse proxy run it with --proxy-headers, and let the
    proxy overwrite X-Forwarded-For with the real peer address (infrastructure/nginx), or a client sets its own.
    """

    def __init__(self, *, limit: int, interval_seconds: float = 60.0) -> None:
        """
        Initializes the rate limiter.

        :param limit: How many requests one IP may make within the interval.
        :param interval_seconds: The length of the window.
        """
        self.limiter: SlidingWindowLimiter = SlidingWindowLimiter(limit=limit, interval_seconds=interval_seconds)

    async def __call__(self, request: Request) -> None:
        """
        Checks whether the client's IP is rate-limited, and counts the request.

        :param request: The FastAPI request object to get the client's IP.
        :return: None if the request is allowed.
        :raises HTTPException: 429 if the client has used up its requests within the interval.
        """
        client: Address | None = request.client
        ip_address: str = client.host if client else "unknown"
        if self.limiter.is_exceeded(key=ip_address):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a minute before trying again.",
            )
        self.limiter.add(key=ip_address)


_resend_verification_limiter: RateLimiterProvider = RateLimiterProvider(limit=1)
_login_limiter: RateLimiterProvider = RateLimiterProvider(limit=10)
_password_recovery_limiter: RateLimiterProvider = RateLimiterProvider(limit=3)
_signup_limiter: RateLimiterProvider = RateLimiterProvider(limit=5)
# Failed logins per account, whatever IP they come from: 5 within 15 minutes lock the account's login for that time
_failed_logins: SlidingWindowLimiter = SlidingWindowLimiter(limit=5, interval_seconds=15 * 60.0)

# Every limiter of the application, for the tests to reset
ALL_LIMITERS: tuple[SlidingWindowLimiter, ...] = (
    _resend_verification_limiter.limiter,
    _login_limiter.limiter,
    _password_recovery_limiter.limiter,
    _signup_limiter.limiter,
    _failed_logins,
)


def _get_failed_logins() -> SlidingWindowLimiter:
    """
    Dependency for the counter of failed logins per account.

    :return: The limiter.
    """
    return _failed_logins


# 5. Final dependency aliases for use in path operations
CurrentUser = Annotated[User, Depends(CurrentUserProvider())]
CurrentSuperuser = Annotated[User, Depends(ActiveSuperuserProvider())]
OptionalCurrentUser = Annotated[User | None, Depends(OptionalCurrentUserProvider())]
FailedLoginsDep = Annotated[SlidingWindowLimiter, Depends(_get_failed_logins)]
# Dependency objects for 'dependencies=[...]' of a route; fastapi.Depends() would be typed as Any
ResendVerificationRateLimiter: params.Depends = params.Depends(dependency=_resend_verification_limiter)
LoginRateLimiter: params.Depends = params.Depends(dependency=_login_limiter)
PasswordRecoveryRateLimiter: params.Depends = params.Depends(dependency=_password_recovery_limiter)
SignupRateLimiter: params.Depends = params.Depends(dependency=_signup_limiter)

# 6. Pagination: bounded, so that a request can neither ask for the whole table nor crash the query
MAX_PAGE_SIZE: int = 100
SkipQuery = Annotated[int, Query(ge=0, le=2**31 - 1, description="The number of rows to skip")]
LimitQuery = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, description="The maximum number of rows to return")]
