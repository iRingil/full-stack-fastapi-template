"""
Tests for src/app/core/middleware.py: the error answers, their one-line log and CORS.

The middleware runs in a bare FastAPI application with a failing route, over the test database.
"""

# ruff: noqa: PLR2004, S101

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from starlette.types import Message, Scope

from app.core.config import AppSettings, Settings
from app.core.db import DatabaseManager
from app.core.middleware import DbSessionMiddleware, MiddlewareConfigurator

__all__: tuple[str, ...] = ()


def _failing_app(settings: Settings, db_manager: DatabaseManager) -> FastAPI:
    """
    A FastAPI application with the middleware and a route that fails with a two-line message.

    :param settings: The settings for the middleware.
    :param db_manager: The database manager for the middleware.
    :return: The application.
    """
    application: FastAPI = FastAPI()

    @application.get(path="/boom")
    async def boom() -> None:
        """
        Fails.

        :return: None
        """
        raise RuntimeError("first line\nsecond line")

    MiddlewareConfigurator(app=application, settings=settings, db_manager=db_manager).add_all_middleware()
    return application


class TestDbSessionMiddleware:
    """Tests for the error handling of DbSessionMiddleware."""

    async def test_unhandled_error_gives_500_and_one_log_line(
        self, settings: Settings, db_manager: DatabaseManager, log_messages: list[str]
    ) -> None:
        """
        An unhandled error answers 500 and is logged in one line with the method, the path and the first line.

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :param log_messages: The messages logged during the test.
        :return: None
        """
        transport: ASGITransport = ASGITransport(app=_failing_app(settings=settings, db_manager=db_manager))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response: Response = await client.get(url="/boom")
        assert response.status_code == 500
        assert response.text == "Internal Server Error"
        assert len(log_messages) == 1
        assert log_messages[0].startswith("GET /boom failed: RuntimeError: first line (")
        assert "second line" not in log_messages[0]

    async def test_request_without_a_client_gets_no_body(self, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        A request without a client address (like a webhook call) gets 204 without a body.

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :return: None
        """
        scope: Scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/boom",
            "raw_path": b"/boom",
            "query_string": b"",
            "root_path": "",
            "headers": [(b"host", b"test")],
            "client": None,
            "server": ("test", 80),
        }
        sent: list[Message] = []

        async def receive() -> Message:
            """
            The request has no body.

            :return: The request message.
            """
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message: Message) -> None:
            """
            Collects the response messages.

            :param message: A response message.
            :return: None
            """
            sent.append(message)

        await _failing_app(settings=settings, db_manager=db_manager)(scope, receive, send)
        assert sent[0]["status"] == 204


class TestCors:
    """Tests for the CORS middleware."""

    async def test_allows_the_configured_origins(self, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        A preflight request from a configured origin is allowed.

        :param settings: The test settings (origin http://localhost and the frontend host).
        :param db_manager: The test database manager.
        :return: None
        """
        transport: ASGITransport = ASGITransport(app=_failing_app(settings=settings, db_manager=db_manager))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response: Response = await client.options(
                url="/boom", headers={"Origin": "http://localhost", "Access-Control-Request-Method": "GET"}
            )
        assert response.headers["access-control-allow-origin"] == "http://localhost"

    async def test_no_cors_without_origins(
        self, monkeypatch: pytest.MonkeyPatch, settings: Settings, db_manager: DatabaseManager
    ) -> None:
        """
        Without any origin no CORS middleware is added.

        :param monkeypatch: pytest's monkeypatch fixture.
        :param settings: The test settings.
        :param db_manager: The test database manager.
        :return: None
        """
        monkeypatch.setattr(target=AppSettings, name="all_cors_origins", value=property(lambda _: []))
        application: FastAPI = FastAPI()
        MiddlewareConfigurator(app=application, settings=settings, db_manager=db_manager).add_all_middleware()
        assert [entry.cls for entry in application.user_middleware] == [DbSessionMiddleware]
