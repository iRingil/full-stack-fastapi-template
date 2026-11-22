"""
Tests for src/app/api/deps.py: token decoding, the current user providers, the limiters and the page bounds.

The providers run over the real application (the test database behind it); the rate limiter gets real
Starlette requests.
"""

# ruff: noqa: PLR2004, S101, S106, SLF001

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from httpx import AsyncClient, Response
from starlette.requests import Request

# noinspection PyProtectedMember
from app.api.deps import RateLimiterProvider, SlidingWindowLimiter, _decode_access_token
from app.core.config import Settings
from app.core.security import SecurityManager
from app.crud.user import UserCRUD
from app.models import User
from tests.conftest import AuthHeaders, UserFactory

__all__: tuple[str, ...] = ()


def _token(settings: Settings, payload: dict[str, object]) -> str:
    """
    Signs an arbitrary JWT payload with the application key.

    :param settings: The test settings.
    :param payload: The payload.
    :return: The token.
    """
    return jwt.encode(
        payload=payload, key=settings.security.secret_key.get_secret_value(), algorithm=SecurityManager.ALGORITHM
    )


def _request(client: tuple[str, int] | None) -> Request:
    """
    Builds a bare HTTP request.

    :param client: The client address, or None for a request without one.
    :return: The request.
    """
    return Request(scope={"type": "http", "method": "POST", "path": "/", "headers": [], "client": client})


class TestDecodeAccessToken:
    """Tests for _decode_access_token."""

    def test_decodes_the_user_id_and_the_version(self, settings: Settings, security_manager: SecurityManager) -> None:
        """
        An access token gives the user ID and the token version.

        :param settings: The test settings.
        :param security_manager: The test security manager.
        :return: None
        """
        user_id = uuid4()
        token: str = security_manager.create_access_token(
            subject=str(user_id), expires_delta=timedelta(minutes=1), version=3
        )
        assert _decode_access_token(token=token, settings=settings, security_manager=security_manager) == (user_id, 3)

    @pytest.mark.parametrize(
        argnames="claims",
        argvalues=[{"exp": 0, "sub": str(uuid4())}, {}, {"sub": 123}, {"sub": "not-a-uuid"}],
        ids=["expired", "no-subject", "subject-not-a-string", "subject-not-a-uuid"],
    )
    def test_rejects_a_bad_token(
        self, settings: Settings, security_manager: SecurityManager, claims: dict[str, object]
    ) -> None:
        """
        Every kind of bad token gives 401 with the Bearer challenge.

        :param settings: The test settings.
        :param security_manager: The test security manager.
        :param claims: The claims that make the token bad (they override a valid expiry).
        :return: None
        """
        payload: dict[str, object] = {"exp": datetime.now(tz=UTC) + timedelta(minutes=1), **claims}
        with pytest.raises(HTTPException) as exc_info:
            _decode_access_token(
                token=_token(settings=settings, payload=payload), settings=settings, security_manager=security_manager
            )
        assert exc_info.value.status_code == 401
        assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


class TestCurrentUser:
    """Tests for the strict and the optional current user providers, through routes that use them."""

    async def test_strict_unknown_user(self, client: AsyncClient, auth_headers: AuthHeaders) -> None:
        """
        A valid token of a deleted user gives 401 on a route that requires a user: the client logs out on 401.

        :param client: The HTTP client of the application.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        ghost: User = User(email="ghost@example.com", hashed_password="x")
        response: Response = await client.get(url="/users/me", headers=auth_headers(ghost))
        assert response.status_code == 401

    async def test_strict_inactive_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        An inactive user gets 401 on a route that requires a user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user(is_active=False)
        response: Response = await client.get(url="/users/me", headers=auth_headers(user))
        assert response.status_code == 401

    async def test_strict_revoked_token(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders, user_crud: UserCRUD
    ) -> None:
        """
        A token issued before the tokens of the user were revoked gives 401; a token of the new version works.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :param user_crud: The UserCRUD over the test session.
        :return: None
        """
        user: User = await create_user()
        old_headers: dict[str, str] = auth_headers(user)
        await user_crud.revoke_tokens(db_obj=user)
        assert (await client.get(url="/users/me", headers=old_headers)).status_code == 401
        assert (await client.get(url="/users/me", headers=auth_headers(user))).status_code == 200

    async def test_strict_token_without_a_version(
        self, client: AsyncClient, create_user: UserFactory, settings: Settings
    ) -> None:
        """
        A token without the version claim (issued before the claim existed) gives 401.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param settings: The test settings.
        :return: None
        """
        user: User = await create_user()
        payload: dict[str, object] = {"exp": datetime.now(tz=UTC) + timedelta(minutes=1), "sub": str(user.id)}
        headers: dict[str, str] = {"Authorization": f"Bearer {_token(settings=settings, payload=payload)}"}
        assert (await client.get(url="/users/me", headers=headers)).status_code == 401

    async def test_strict_bad_token(self, client: AsyncClient) -> None:
        """
        A bad token gives 401 with the Bearer challenge.

        :param client: The HTTP client of the application.
        :return: None
        """
        response: Response = await client.get(url="/users/me", headers={"Authorization": "Bearer garbage"})
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"

    async def test_optional_inactive_user_is_anonymous(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        On a route with optional authentication an inactive user counts as anonymous.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user(is_active=False)
        response: Response = await client.post(url="/items/", json={"title": "New"}, headers=auth_headers(user))
        assert response.status_code == 401


class TestSlidingWindowLimiter:
    """Tests for SlidingWindowLimiter."""

    def test_counts_each_key_separately(self) -> None:
        """
        A key is exceeded after its limit of events; another key is not affected.

        :return: None
        """
        limiter: SlidingWindowLimiter = SlidingWindowLimiter(limit=2, interval_seconds=60)
        limiter.add(key="a")
        assert not limiter.is_exceeded(key="a")
        limiter.add(key="a")
        assert limiter.is_exceeded(key="a")
        assert not limiter.is_exceeded(key="b")

    def test_forgets_expired_events(self) -> None:
        """
        Events older than the window no longer count, and their keys are dropped.

        :return: None
        """
        limiter: SlidingWindowLimiter = SlidingWindowLimiter(limit=1, interval_seconds=0)
        limiter.add(key="a")
        assert not limiter.is_exceeded(key="a")
        assert limiter._events == {}

    def test_clear(self) -> None:
        """
        One key or all the keys can be forgotten; clearing an unknown key does nothing.

        :return: None
        """
        limiter: SlidingWindowLimiter = SlidingWindowLimiter(limit=1, interval_seconds=60)
        limiter.add(key="a")
        limiter.add(key="b")
        limiter.clear(key="a")
        limiter.clear(key="unknown")
        assert list(limiter._events) == ["b"]
        limiter.clear()
        assert limiter._events == {}


class TestRateLimiterProvider:
    """Tests for RateLimiterProvider."""

    async def test_limits_each_ip_separately(self) -> None:
        """
        A request over the limit from the same IP within the interval gets 429; another IP is not affected.

        :return: None
        """
        limiter: RateLimiterProvider = RateLimiterProvider(limit=1)
        await limiter(request=_request(client=("10.0.0.1", 1)))
        await limiter(request=_request(client=("10.0.0.2", 1)))
        with pytest.raises(HTTPException) as exc_info:
            await limiter(request=_request(client=("10.0.0.1", 2)))
        assert exc_info.value.status_code == 429

    async def test_request_without_a_client(self) -> None:
        """
        A request without a client address is limited under the 'unknown' key.

        :return: None
        """
        limiter: RateLimiterProvider = RateLimiterProvider(limit=1)
        await limiter(request=_request(client=None))
        assert list(limiter.limiter._events) == ["unknown"]


class TestPageBounds:
    """Tests for SkipQuery and LimitQuery, through a route that uses them."""

    @pytest.mark.parametrize(
        argnames="query", argvalues=["skip=-1", "limit=0", "limit=-5", "limit=101", "skip=99999999999999999999"]
    )
    async def test_rejects_out_of_range_values(self, client: AsyncClient, query: str) -> None:
        """
        A negative or huge skip and a limit outside 1..100 are validation errors, not database errors.

        :param client: The HTTP client of the application.
        :param query: The query string.
        :return: None
        """
        assert (await client.get(url=f"/items/?{query}")).status_code == 422
