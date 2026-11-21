"""Tests for src/app/core/db.py (DatabaseManager): the database URI and the connection lifecycle."""

# ruff: noqa: S101, SLF001

from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy.pool import AsyncAdaptedQueuePool, Pool

from app.core.config import Settings
from app.core.db import DatabaseManager, get_db_manager
from tests.conftest import with_settings

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


class TestBuildDatabaseUrl:
    """Tests for DatabaseManager._build_database_url."""

    @staticmethod
    def _url(settings: Settings) -> str:
        """
        The URL of the settings as a string, with the password.

        :param settings: The settings.
        :return: The URL.
        """
        return DatabaseManager._build_database_url(settings=settings).render_as_string(hide_password=False)

    def test_host_and_port(self, settings: Settings) -> None:
        """
        Locally the URL points at host:port; the password is escaped.

        :param settings: The test settings.
        :return: None
        """
        local: Settings = with_settings(settings=settings, group="postgres", password=SecretStr("p@ss"))
        assert self._url(settings=local) == "postgresql+asyncpg://test_user:p%40ss@127.0.0.1:5432/test_db"

    def test_ipv6_host(self, settings: Settings) -> None:
        """
        An IPv6 host goes in square brackets.

        :param settings: The test settings.
        :return: None
        """
        ipv6: Settings = with_settings(settings=settings, group="postgres", server="::1")
        assert self._url(settings=ipv6) == "postgresql+asyncpg://test_user:test_password@[::1]:5432/test_db"

    def test_socket_in_production(self, settings: Settings) -> None:
        """
        In production a configured socket replaces host and port.

        :param settings: The test settings.
        :return: None
        """
        production: Settings = with_settings(
            settings=with_settings(settings=settings, group="app", environment="production"),
            group="postgres",
            socket=Path("/var/run/postgresql"),
        )
        assert self._url(settings=production).startswith("postgresql+asyncpg://test_user:test_password@/test_db?host=")

    @pytest.mark.parametrize(argnames="environment", argvalues=["local", "production"])
    def test_without_a_password(self, settings: Settings, environment: str) -> None:
        """
        Without a password the user goes alone; in production without a socket host and port are used.

        :param settings: The test settings.
        :param environment: The environment.
        :return: None
        """
        no_password: Settings = with_settings(
            settings=with_settings(settings=settings, group="app", environment=environment),
            group="postgres",
            password=None,
        )
        assert self._url(settings=no_password) == "postgresql+asyncpg://test_user@127.0.0.1:5432/test_db"


class TestLifecycle:
    """Tests for connecting and closing."""

    async def test_connects_and_closes(self, db_manager: DatabaseManager) -> None:
        """
        The startup check runs a query on the real database, and closing empties the pool.

        :param db_manager: The test database manager.
        :return: None
        """
        await db_manager.connect_to_database()
        assert _pool(db_manager=db_manager).checkedin() == 1
        await db_manager.close_database_connection()
        assert _pool(db_manager=db_manager).checkedin() == 0


def test_get_db_manager_is_a_singleton() -> None:
    """
    get_db_manager always returns the same manager.

    :return: None
    """
    assert get_db_manager() is get_db_manager()
