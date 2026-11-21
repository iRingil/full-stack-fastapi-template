"""Tests for src/app/app_factory.py (AppFactory): the application setup per environment and the lifespan."""

# ruff: noqa: S101

from pathlib import Path

import pytest
from sqlalchemy.pool import AsyncAdaptedQueuePool, Pool

import app.app_factory as app_factory  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
from app.app_factory import AppFactory
from app.core.config import Settings
from app.core.db import DatabaseManager

__all__: tuple[str, ...] = ()


def _pool(db_manager: DatabaseManager) -> AsyncAdaptedQueuePool:
    """
    The connection pool of a database manager.

    :param db_manager: The database manager.
    :return: The pool (the asyncpg engine uses a queue pool).
    """
    pool: Pool = db_manager.engine.pool
    assert isinstance(pool, AsyncAdaptedQueuePool)
    return pool


@pytest.fixture(name="logging_calls")
def logging_calls_fixture(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, object]]:
    """
    Replaces the global logging setup with a recorder of its arguments (it is tested in test_log_setup.py).

    :param monkeypatch: pytest's monkeypatch fixture.
    :return: The list of the keyword arguments of each call.
    """
    calls: list[dict[str, object]] = []
    monkeypatch.setattr(target=app_factory, name="LoggingManager", value=lambda **kwargs: calls.append(kwargs))
    return calls


class TestAppFactory:
    """Tests for AppFactory."""

    def test_local_application(
        self, settings: Settings, db_manager: DatabaseManager, logging_calls: list[dict[str, object]]
    ) -> None:
        """
        A local application has debug mode and the documentation, and its logging is in debug mode too.

        :param settings: The test settings (local environment).
        :param db_manager: The test database manager.
        :param logging_calls: The recorded logging setup calls.
        :return: None
        """
        application = AppFactory(settings=settings, db_manager=db_manager).app
        assert application.title == "Test Project"
        assert application.debug is True
        assert application.openapi_url == "/api/v1/openapi.json"
        assert application.docs_url == "/docs"
        assert logging_calls == [
            {"debug": True, "log_dir": Path(settings.BASE_DIR, "logs"), "project_name": "Test Project"}
        ]

    @pytest.mark.usefixtures("logging_calls")
    def test_production_application(self, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        A production application has neither debug mode nor any documentation endpoint.

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :return: None
        """
        production: Settings = settings.model_copy(update={"ENVIRONMENT": "production"})
        application = AppFactory(settings=production, db_manager=db_manager).app
        assert application.debug is False
        assert (application.openapi_url, application.docs_url, application.redoc_url) == (None, None, None)

    @pytest.mark.usefixtures("logging_calls")
    def test_operation_ids(self, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        Operation IDs are '{first tag}-{route name}', which names the methods of the generated frontend client.

        A class-based view route is named '{class}.{method}' (fastapi-utils cbv).

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :return: None
        """
        application = AppFactory(settings=settings, db_manager=db_manager).app
        paths: dict[str, dict[str, dict[str, str]]] = application.openapi()["paths"]
        operation_ids: set[str] = {operation["operationId"] for path in paths.values() for operation in path.values()}
        assert "users-UsersRouter.read_user_me" in operation_ids
        assert "login-LoginRouter.login_access_token" in operation_ids

    @pytest.mark.usefixtures("logging_calls")
    async def test_lifespan_connects_and_disconnects(self, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        The lifespan checks the database connection on startup and closes the pool on shutdown.

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :return: None
        """
        application = AppFactory(settings=settings, db_manager=db_manager).app
        async with application.router.lifespan_context(application):
            assert _pool(db_manager=db_manager).checkedin() == 1
        assert _pool(db_manager=db_manager).checkedin() == 0
