"""
Alembic's environment: runs the migrations against the database of the application's settings.

The schema the migrations are compared with (by Alembic's autogenerate and check commands) is the SQLModel metadata
of app.models. The log goes through the application's logging, one line per message.
"""

from asyncio import run

from alembic import context
from sqlalchemy.engine import Connection
from sqlmodel import SQLModel

import app.models  # noqa: F401  # pyright: ignore[reportUnusedImport] - registers the tables in SQLModel.metadata
from app.core.config import Settings, get_settings
from app.core.constants import BASE_DIR
from app.core.db import DatabaseManager
from app.core.log_setup import LoggingManager

__all__: tuple[str, ...] = ()


def _run_migrations(connection: Connection) -> None:
    """
    Runs the migrations over an open connection, in one transaction.

    :param connection: The connection.
    :return: None
    """
    context.configure(
        connection=connection,
        target_metadata=SQLModel.metadata,
        compare_type=True,
        # SQLModel's own column types are written by their bare names (the template imports them)
        user_module_prefix="",
    )
    with context.begin_transaction():
        context.run_migrations()


async def _run_online(db_manager: DatabaseManager) -> None:
    """
    Runs the migrations against the database.

    :param db_manager: The database manager of the settings.
    :return: None
    """
    async with db_manager.engine.connect() as connection:
        # PyCharm misreads run_sync's Concatenate signature (basedpyright checks it)
        # noinspection PyTypeChecker
        await connection.run_sync(fn=_run_migrations)
    await db_manager.close_database_connection()


def _run_offline(db_manager: DatabaseManager) -> None:
    """
    Prints the SQL of the migrations instead of running it (Alembic's offline mode, the --sql option).

    :param db_manager: The database manager of the settings, for the SQL dialect.
    :return: None
    """
    context.configure(
        url=db_manager.engine.url,
        target_metadata=SQLModel.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


settings: Settings = get_settings()
LoggingManager(debug=False, log_dir=BASE_DIR / "logs", project_name=settings.app.project_name)
if context.is_offline_mode():
    _run_offline(db_manager=DatabaseManager(settings=settings))
else:
    run(main=_run_online(db_manager=DatabaseManager(settings=settings)))
