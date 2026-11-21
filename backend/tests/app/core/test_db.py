"""Tests for src/app/core/db.py (DatabaseManager): the database URI and the connection lifecycle."""

# ruff: noqa: S101, SLF001

import pytest
from pydantic import SecretStr
from sqlalchemy.pool import AsyncAdaptedQueuePool, Pool

from app.core.config import Settings
from app.core.db import DatabaseManager, get_db_manager

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


class TestBuildDatabaseUri:
    """Tests for DatabaseManager._build_database_uri."""

    def test_host_and_port(self, settings: Settings) -> None:
        """
        Locally the URI points at host:port; the password is percent-encoded.

        :param settings: The test settings.
        :return: None
        """
        local: Settings = settings.model_copy(update={"POSTGRES_PASSWORD": SecretStr("p@ss word")})
        assert DatabaseManager._build_database_uri(settings=local) == (
            "postgresql+asyncpg://test_user:p%40ss+word@127.0.0.1:5432/test_db"
        )

    def test_socket_in_production(self, settings: Settings) -> None:
        """
        In production a configured socket replaces host and port.

        :param settings: The test settings.
        :return: None
        """
        production: Settings = settings.model_copy(
            update={"ENVIRONMENT": "production", "POSTGRES_SOCKET": "/var/run/postgresql"}
        )
        assert DatabaseManager._build_database_uri(settings=production) == (
            "postgresql+asyncpg://test_user:test_password@/test_db?host=%2Fvar%2Frun%2Fpostgresql"
        )

    @pytest.mark.parametrize(argnames="environment", argvalues=["local", "production"])
    def test_without_a_password(self, settings: Settings, environment: str) -> None:
        """
        Without a password the user goes alone; in production without a socket host and port are used.

        :param settings: The test settings.
        :param environment: The environment.
        :return: None
        """
        no_password: Settings = settings.model_copy(
            update={"POSTGRES_PASSWORD": SecretStr(""), "ENVIRONMENT": environment}
        )
        assert DatabaseManager._build_database_uri(settings=no_password) == (
            "postgresql+asyncpg://test_user@127.0.0.1:5432/test_db"
        )


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
