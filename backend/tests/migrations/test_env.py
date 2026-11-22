"""
Tests for src/migrations: the migrations build exactly the schema of app.models, and undo it.

Synchronous tests: Alembic's environment starts the event loop itself. The global logging setup is replaced by a
recorder (it is tested in test_log_setup.py).
"""

# ruff: noqa: S101

import asyncio
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, text
from sqlmodel import SQLModel

import app.core.log_setup as log_setup  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
from app.core.config import Settings
from app.core.constants import BASE_DIR
from app.core.db import DatabaseManager

__all__: tuple[str, ...] = ()

# The tables of app.models
APP_TABLES: tuple[str, ...] = ("user", "item")


@pytest.fixture(name="alembic_config")
def alembic_config_fixture(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> Iterator[Config]:
    """
    Alembic's configuration of the project, with the logging setup recorded instead of applied.

    Afterward, whatever the migrations left in the test database is dropped.

    :param monkeypatch: pytest's monkeypatch fixture.
    :param settings: The test settings.
    :return: The configuration.
    """
    monkeypatch.setattr(target=log_setup, name="LoggingManager", value=lambda **_: None)
    # Other tests register their own tables in the shared metadata (test_base.py: test_tag); the migrations are
    # compared with the application's tables only
    app_metadata: MetaData = MetaData()
    for table_name in APP_TABLES:
        _ = SQLModel.metadata.tables[table_name].to_metadata(metadata=app_metadata)
    monkeypatch.setattr(target=SQLModel, name="metadata", value=app_metadata)
    yield Config(file_=BASE_DIR / "alembic.ini")

    async def clean() -> None:
        """
        Drops the tables of the migrations and Alembic's own table.

        :return: None
        """
        cleaner: DatabaseManager = DatabaseManager(settings=settings)
        async with cleaner.engine.begin() as conn:
            for table in (*reversed(APP_TABLES), "alembic_version"):
                _ = await conn.execute(statement=text(f'DROP TABLE IF EXISTS "{table}"'))
        await cleaner.close_database_connection()

    asyncio.run(clean())


def test_migrations_match_the_models(alembic_config: Config) -> None:
    """
    Applied to an empty database, the migrations leave nothing for autogenerate to add; then they undo cleanly.

    A model changed without a migration fails here, not on a deployed database.

    :param alembic_config: Alembic's configuration.
    :return: None
    """
    command.upgrade(config=alembic_config, revision="head")
    command.check(config=alembic_config)
    command.downgrade(config=alembic_config, revision="base")


def test_offline_mode_prints_the_sql(alembic_config: Config, capsys: pytest.CaptureFixture[str]) -> None:
    """
    Alembic's offline mode (upgrade head with --sql) prints the SQL of the migrations without touching the database.

    :param alembic_config: Alembic's configuration.
    :param capsys: pytest's output capture.
    :return: None
    """
    command.upgrade(config=alembic_config, revision="head", sql=True)
    output: str = capsys.readouterr().out
    assert 'CREATE TABLE "user"' in output
