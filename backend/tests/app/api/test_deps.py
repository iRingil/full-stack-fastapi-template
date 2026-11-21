"""
Tests for src/app/api/deps.py: token decoding, the current user providers and the rate limiter.

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

from app.api.deps import ResendVerificationRateLimiterProvider, _decode_user_id_from_token
from app.core.config import Settings
from app.core.security import SecurityManager
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
    return jwt.encode(payload=payload, key=settings.SECRET_KEY.get_secret_value(), algorithm=SecurityManager.ALGORITHM)


def _request(client: tuple[str, int] | None) -> Request:
    """
    Builds a bare HTTP request.

    :param client: The client address, or None for a request without one.
    :return: The request.
    """
    return Request(scope={"type": "http", "method": "POST", "path": "/", "headers": [], "client": client})


class TestDecodeUserIdFromToken:
    """Tests for _decode_user_id_from_token."""

    def test_decodes_the_user_id(self, settings: Settings, security_manager: SecurityManager) -> None:
        """
        An access token gives the user ID.

        :param settings: The test settings.
        :param security_manager: The test security manager.
        :return: None
        """
        user_id = uuid4()
        token: str = security_manager.create_access_token(subject=str(user_id), expires_delta=timedelta(minutes=1))
        assert _decode_user_id_from_token(token=token, settings=settings, security_manager=security_manager) == user_id

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
            _decode_user_id_from_token(
                token=_token(settings=settings, payload=payload), settings=settings, security_manager=security_manager
            )
        assert exc_info.value.status_code == 401
        assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


class TestCurrentUser:
    """Tests for the strict and the optional current user providers, through routes that use them."""

    async def test_strict_unknown_user(self, client: AsyncClient, auth_headers: AuthHeaders) -> None:
        """
        A valid token of a deleted user gives 404 on a route that requires a user.

        :param client: The HTTP client of the application.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        ghost: User = User(email="ghost@example.com", hashed_password="x")
        response: Response = await client.get(url="/users/me", headers=auth_headers(ghost))
        assert response.status_code == 404

    async def test_strict_inactive_user(
        self, client: AsyncClient, create_user: UserFactory, auth_headers: AuthHeaders
    ) -> None:
        """
        An inactive user gets 400 on a route that requires a user.

        :param client: The HTTP client of the application.
        :param create_user: The user factory.
        :param auth_headers: Builds the Authorization header of a user.
        :return: None
        """
        user: User = await create_user(is_active=False)
        response: Response = await client.get(url="/users/me", headers=auth_headers(user))
        assert response.status_code == 400

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


class TestResendVerificationRateLimiter:
    """Tests for ResendVerificationRateLimiterProvider."""

    async def test_limits_each_ip_separately(self) -> None:
        """
        A second request from the same IP within the interval gets 429; another IP is not affected.

        :return: None
        """
        limiter: ResendVerificationRateLimiterProvider = ResendVerificationRateLimiterProvider()
        await limiter(request=_request(client=("10.0.0.1", 1)))
        await limiter(request=_request(client=("10.0.0.2", 1)))
        with pytest.raises(HTTPException) as exc_info:
            await limiter(request=_request(client=("10.0.0.1", 2)))
        assert exc_info.value.status_code == 429

    async def test_forgets_expired_requests(self) -> None:
        """
        After the interval the IP may ask again, and the old entry is dropped.

        :return: None
        """
        limiter: ResendVerificationRateLimiterProvider = ResendVerificationRateLimiterProvider(interval_seconds=0)
        await limiter(request=_request(client=("10.0.0.1", 1)))
        await limiter(request=_request(client=("10.0.0.1", 1)))
        assert list(limiter._last_request_at) == ["10.0.0.1"]

    async def test_request_without_a_client(self) -> None:
        """
        A request without a client address is limited under the 'unknown' key.

        :return: None
        """
        limiter: ResendVerificationRateLimiterProvider = ResendVerificationRateLimiterProvider()
        await limiter(request=_request(client=None))
        assert list(limiter._last_request_at) == ["unknown"]
