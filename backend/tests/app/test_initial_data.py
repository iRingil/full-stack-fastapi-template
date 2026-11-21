"""
Tests for src/app/initial_data.py: the tables and the first superuser in the test database.

The global logging setup is replaced by a recorder (it is tested in test_log_setup.py).
"""

# ruff: noqa: S101

import asyncio
import runpy
import sys
from pathlib import Path

import pytest
from sqlmodel import SQLModel, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

import app.core.db as db  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
import app.core.log_setup as log_setup  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
import app.initial_data as initial_data  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
from app.core.config import Settings
from app.core.db import DatabaseManager
from app.crud.user import UserCRUD
from app.initial_data import InitialDataGenerator
from app.models import User

__all__: tuple[str, ...] = ()


class TestInitialDataGenerator:
    """Tests for InitialDataGenerator."""

    async def test_creates_the_first_superuser_once(
        self,
        settings: Settings,
        db_manager: DatabaseManager,
        session: AsyncSession,
        user_crud: UserCRUD,
        log_messages: list[str],
    ) -> None:
        """
        The first run creates a verified superuser who can log in; the second run leaves the users alone.

        :param settings: The test settings.
        :param db_manager: The test database manager.
        :param session: The test session.
        :param user_crud: The UserCRUD over the test session.
        :param log_messages: The messages logged during the test.
        :return: None
        """
        generator: InitialDataGenerator = InitialDataGenerator(db_manager=db_manager, settings=settings)
        await generator.run()
        await generator.run()
        assert (await session.exec(statement=select(func.count()).select_from(User))).one() == 1
        superuser: User | None = await user_crud.authenticate(
            email=settings.FIRST_SUPERUSER, password=settings.FIRST_SUPERUSER_PASSWORD.get_secret_value()
        )
        assert superuser is not None
        assert superuser.is_superuser
        assert superuser.is_email_verified
        assert "First superuser already exists. Skipping." in log_messages


async def test_main_uses_the_global_settings(monkeypatch: pytest.MonkeyPatch, db_manager: DatabaseManager) -> None:
    """
    main() sets up logging from the settings and runs the generator over the global database manager.

    :param monkeypatch: pytest's monkeypatch fixture.
    :param db_manager: The test database manager, standing in for the global one.
    :return: None
    """
    calls: list[dict[str, object]] = []
    monkeypatch.setattr(target=initial_data, name="LoggingManager", value=lambda **kwargs: calls.append(kwargs))
    monkeypatch.setattr(target=initial_data, name="get_db_manager", value=lambda: db_manager)
    await initial_data.main()
    assert calls == [
        {"debug": True, "log_dir": Path(initial_data.__file__).parents[1] / "logs", "project_name": "Test Project"}
    ]
    async for session in db_manager.get_session():
        assert (await session.exec(statement=select(func.count()).select_from(User))).one() == 1


def test_runs_as_a_script(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> None:
    """
    'python -m app.initial_data' runs main() in its own event loop.

    A synchronous test: the script starts the event loop itself. Its tables are dropped afterwards.

    :param monkeypatch: pytest's monkeypatch fixture.
    :param settings: The test settings.
    :return: None
    """
    script_db_manager: DatabaseManager = DatabaseManager(settings=settings)
    monkeypatch.setattr(target=log_setup, name="LoggingManager", value=lambda **_: None)
    monkeypatch.setattr(target=db, name="get_db_manager", value=lambda: script_db_manager)
    # runpy executes the module anew: an already imported copy would only cause a RuntimeWarning
    monkeypatch.delitem(sys.modules, "app.initial_data", raising=False)
    runpy.run_module(mod_name="app.initial_data", run_name="__main__")

    async def check_and_clean() -> int:
        """
        Counts the users the script created and drops its tables.

        :return: The number of users.
        """
        cleaner: DatabaseManager = DatabaseManager(settings=settings)
        users: int = 0
        async for session in cleaner.get_session():
            users = (await session.exec(statement=select(func.count()).select_from(User))).one()
        async with cleaner.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)
        await cleaner.close_database_connection()
        return users

    assert asyncio.run(check_and_clean()) == 1
