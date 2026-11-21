"""Module for creating initial database schema and data."""

from asyncio import run

from loguru import logger
from sqlmodel import SQLModel

from app.core.config import Settings, get_settings
from app.core.db import DatabaseManager, get_db_manager
from app.core.log_setup import LoggingManager
from app.core.security import get_security_manager
from app.crud.user import UserCRUD
from app.models import User, UserCreate

__all__: tuple[str, ...] = ()


class InitialDataGenerator:
    """Handles the creation of initial database schema and data."""

    def __init__(self, db_manager: DatabaseManager, settings: Settings) -> None:
        """
        Initializes the initial data generator.

        :param db_manager: The database manager to use for creating tables and sessions.
        :param settings: The application settings object.
        """
        self._db_manager: DatabaseManager = db_manager
        self._settings: Settings = settings

    async def create_tables(self) -> None:
        """
        Creates all database tables based on SQLModel metadata.

        :return: None
        """
        logger.info("Creating tables...")
        async with self._db_manager.engine.begin() as conn:
            await conn.run_sync(fn=SQLModel.metadata.create_all)
        logger.info("Tables created.")

    async def create_first_superuser(self) -> None:
        """
        Creates the first superuser if it doesn't exist.

        :return: None
        """
        logger.info("Creating first superuser...")
        async for session in self._db_manager.get_session():
            user_crud: UserCRUD = UserCRUD(session=session, security_manager=get_security_manager())
            user: User | None = await user_crud.get_by_email(email=self._settings.FIRST_SUPERUSER)
            if not user:
                user_in: UserCreate = UserCreate(
                    email=self._settings.FIRST_SUPERUSER,
                    password=self._settings.FIRST_SUPERUSER_PASSWORD.get_secret_value(),
                    is_superuser=True,
                    is_email_verified=True,
                )
                await user_crud.create(obj_in=user_in)
                logger.info("First superuser created.")
            else:
                logger.info("First superuser already exists. Skipping.")

    async def run(self) -> None:
        """
        Runs the entire data initialization process.

        :return: None
        """
        await self.create_tables()
        await self.create_first_superuser()


async def main() -> None:
    """
    Main function to set up and run the generator.

    :return: None
    """
    settings: Settings = get_settings()
    LoggingManager(
        debug=settings.ENVIRONMENT == "local", log_dir=settings.BASE_DIR / "logs", project_name=settings.PROJECT_NAME
    )
    generator: InitialDataGenerator = InitialDataGenerator(db_manager=get_db_manager(), settings=settings)
    await generator.run()


if __name__ == "__main__":
    run(main=main())
