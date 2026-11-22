"""
Shared pytest fixtures for the whole test suite.

The database fixtures connect to the throwaway test PostgreSQL: locally the WSL one, in CI the pytest workflow's
service container, both with the same credentials. 127.0.0.1, never localhost: localhost resolves to ::1 first,
and the WSL port relay is IPv4 only.

The settings come only from the environment variables below: the settings groups do not read any .env file in the
tests, so a developer's own backend/src/.env never leaks in.
"""

# ruff: noqa: E402, S101, S105, SLF001

import os

_TEST_ENV: dict[str, str] = {
    "PROJECT_NAME": "Test Project",
    "ENVIRONMENT": "local",
    "SECRET_KEY": "test-secret-key-for-the-test-suite-only",
    "FIRST_SUPERUSER": "admin@example.com",
    "FIRST_SUPERUSER_PASSWORD": "admin-password",
    "FRONTEND_HOST": "http://localhost:5173",
    "BACKEND_CORS_ORIGINS": "http://localhost",
    "POSTGRES_SERVER": "127.0.0.1",
    "POSTGRES_PORT": "5432",
    "POSTGRES_USER": "test_user",
    "POSTGRES_PASSWORD": "test_password",
    "POSTGRES_DB": "test_db",
}
os.environ.update(_TEST_ENV)

from collections.abc import AsyncIterator, Callable, Coroutine, Iterator
from datetime import timedelta
from email.message import EmailMessage

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient
from loguru import logger
from pydantic import BaseModel
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

import app.app_factory as app_factory  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package
from app.api.deps import ResendVerificationRateLimiter, ResendVerificationRateLimiterProvider
from app.app_factory import AppFactory
from app.core.config import (
    AppSettings,
    EmailSettings,
    PostgresSettings,
    SecuritySettings,
    Settings,
    SmtpSettings,
    SuperuserSettings,
    get_settings,
)
from app.core.db import DatabaseManager, get_db_manager
from app.core.emails import EmailManager, get_email_manager
from app.core.security import SecurityManager, get_security_manager
from app.crud.item import ItemCRUD
from app.crud.user import UserCRUD
from app.models import Item, ItemCreate, User, UserCreate

__all__: tuple[str, ...] = (
    "USER_PASSWORD",
    "AuthHeaders",
    "ItemFactory",
    "UserFactory",
    "html_of",
    "text_of",
    "with_settings",
)

for _group in (AppSettings, SecuritySettings, SuperuserSettings, PostgresSettings, SmtpSettings, EmailSettings):
    _group.model_config["env_file"] = None

type UserFactory = Callable[..., Coroutine[None, None, User]]
type ItemFactory = Callable[..., Coroutine[None, None, Item]]
type AuthHeaders = Callable[[User], dict[str, str]]

USER_PASSWORD: str = "user-password"


def with_settings(*, settings: Settings, group: str, **values: object) -> Settings:
    """
    A copy of the settings with some fields of one group replaced (without validation, as model_copy does).

    :param settings: The settings to copy.
    :param group: The name of the group: ``app``, ``security``, ``superuser``, ``postgres``, ``smtp`` or ``email``.
    :param values: The new field values of the group.
    :return: The copy.
    """
    current: object = getattr(settings, group)
    assert isinstance(current, BaseModel)
    return settings.model_copy(update={group: current.model_copy(update=values)})


@pytest.fixture(autouse=True)
def fast_bcrypt(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Hashes passwords with the minimal bcrypt cost (4 rounds instead of 12): the same algorithm, ~250 times faster.

    :param monkeypatch: pytest's monkeypatch fixture.
    :return: None
    """
    real_gensalt: Callable[..., bytes] = bcrypt.gensalt
    monkeypatch.setattr(target=bcrypt, name="gensalt", value=lambda: real_gensalt(rounds=4))


@pytest.fixture(name="settings")
def settings_fixture() -> Settings:
    """
    The settings of the test suite, from _TEST_ENV only.

    :return: The settings.
    """
    return Settings()


@pytest.fixture(name="security_manager")
def security_manager_fixture(settings: Settings) -> SecurityManager:
    """
    The security manager over the test settings.

    :param settings: The test settings.
    :return: The security manager.
    """
    return SecurityManager(settings=settings)


# noinspection PyProtectedMember
@pytest.fixture(name="email_manager")
def email_manager_fixture(settings: Settings, security_manager: SecurityManager) -> EmailManager:
    """
    An email manager with SMTP configured but delivery suppressed: fastapi-mail neither connects nor sends.

    The letters still go through rendering and message building and are recorded by the outbox fixture.

    :param settings: The test settings.
    :param security_manager: The test security manager.
    :return: The email manager.
    """
    smtp_settings: Settings = with_settings(
        settings=with_settings(settings=settings, group="smtp", host="smtp.example.com"),
        group="email",
        from_email="noreply@example.com",
    )
    email_manager: EmailManager = EmailManager(settings=smtp_settings, security_manager=security_manager)
    assert email_manager._fm is not None
    email_manager._fm.config.SUPPRESS_SEND = 1
    return email_manager


# noinspection PyProtectedMember
@pytest.fixture(name="outbox")
def outbox_fixture(email_manager: EmailManager) -> Iterator[list[EmailMessage]]:
    """
    Records the letters "sent" by the email manager fixture during the test.

    :param email_manager: The email manager with suppressed delivery.
    :return: The list that the letters are appended to.
    """
    assert email_manager._fm is not None
    with email_manager._fm.record_messages() as outbox:
        yield outbox


# PyCharm misreads run_sync's Concatenate signature (basedpyright checks it)
# noinspection PyTypeChecker
@pytest.fixture(name="db_manager")
async def db_manager_fixture(settings: Settings) -> AsyncIterator[DatabaseManager]:
    """
    A database manager over the test PostgreSQL with freshly created, empty tables, dropped again after the test.

    :param settings: The test settings.
    :return: The database manager.
    """
    db_manager: DatabaseManager = DatabaseManager(settings=settings)
    async with db_manager.engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
    yield db_manager
    async with db_manager.engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await db_manager.close_database_connection()


@pytest.fixture(name="session")
async def session_fixture(db_manager: DatabaseManager) -> AsyncIterator[AsyncSession]:
    """
    A session of the test database for the tests' own setup and checks.

    :param db_manager: The test database manager.
    :return: The session.
    """
    async for session in db_manager.get_session():
        yield session


@pytest.fixture(name="user_crud")
def user_crud_fixture(session: AsyncSession, security_manager: SecurityManager) -> UserCRUD:
    """
    A UserCRUD over the test session.

    :param session: The test session.
    :param security_manager: The test security manager.
    :return: The UserCRUD.
    """
    return UserCRUD(session=session, security_manager=security_manager)


@pytest.fixture(name="item_crud")
def item_crud_fixture(session: AsyncSession) -> ItemCRUD:
    """
    An ItemCRUD over the test session.

    :param session: The test session.
    :return: The ItemCRUD.
    """
    return ItemCRUD(session=session)


@pytest.fixture(name="create_user")
def create_user_fixture(user_crud: UserCRUD) -> UserFactory:
    """
    A factory that saves a user to the test database.

    :param user_crud: The UserCRUD over the test session.
    :return: An async function taking the UserCreate fields as keyword arguments.
    """

    async def create(**fields: object) -> User:
        """
        Saves a user.

        :param fields: UserCreate fields; email and password have defaults.
        :return: The saved user.
        """
        data: dict[str, object] = {"email": "user@example.com", "password": USER_PASSWORD, **fields}
        return await user_crud.create(obj_in=UserCreate.model_validate(obj=data))

    return create


@pytest.fixture(name="create_item")
def create_item_fixture(item_crud: ItemCRUD) -> ItemFactory:
    """
    A factory that saves an item of the given owner to the test database.

    :param item_crud: The ItemCRUD over the test session.
    :return: An async function taking the owner and the ItemCreate fields as keyword arguments.
    """

    async def create(*, owner: User, **fields: object) -> Item:
        """
        Saves an item.

        :param owner: The owner of the item.
        :param fields: ItemCreate fields; title has a default.
        :return: The saved item.
        """
        item_in: ItemCreate = ItemCreate.model_validate(obj={"title": "Item", **fields})
        return await item_crud.create_with_owner(item_in=item_in, owner_id=owner.id)

    return create


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(security_manager: SecurityManager) -> AuthHeaders:
    """
    A function that builds the Authorization header of a user.

    :param security_manager: The test security manager.
    :return: The function.
    """

    def build(user: User) -> dict[str, str]:
        """
        Builds the header.

        :param user: The user to authenticate as.
        :return: The headers with a valid access token.
        """
        token: str = security_manager.create_access_token(subject=str(user.id), expires_delta=timedelta(minutes=5))
        return {"Authorization": f"Bearer {token}"}

    return build


@pytest.fixture(name="client")
async def client_fixture(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    db_manager: DatabaseManager,
    security_manager: SecurityManager,
    email_manager: EmailManager,
) -> AsyncIterator[AsyncClient]:
    """
    An HTTP client of the real application over the test database.

    The global logging setup is skipped (it is tested in tests/app/core/test_log_setup.py), and the rate limiter
    of verification emails starts empty.

    :param monkeypatch: pytest's monkeypatch fixture.
    :param settings: The test settings.
    :param db_manager: The test database manager.
    :param security_manager: The test security manager.
    :param email_manager: The test email manager.
    :return: The client.
    """
    monkeypatch.setattr(target=app_factory, name="LoggingManager", value=lambda **_: None)
    limiter = ResendVerificationRateLimiter.dependency
    assert isinstance(limiter, ResendVerificationRateLimiterProvider)
    # noinspection PyProtectedMember
    limiter._last_request_at.clear()
    application = AppFactory(settings=settings, db_manager=db_manager).app
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_db_manager] = lambda: db_manager
    application.dependency_overrides[get_security_manager] = lambda: security_manager
    application.dependency_overrides[get_email_manager] = lambda: email_manager
    transport: ASGITransport = ASGITransport(app=application, client=("10.0.0.1", 50000))
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        yield client


@pytest.fixture(name="log_messages")
def log_messages_fixture() -> Iterator[list[str]]:
    """
    Collects the messages logged with loguru during the test.

    :return: The list that the messages are appended to.
    """
    messages: list[str] = []
    handler_id: int = logger.add(sink=lambda message: messages.append(message.record["message"]), level="DEBUG")
    yield messages
    logger.remove(handler_id)


def _body_of(letter: EmailMessage, content_type: str) -> str:
    """
    A body part of a recorded letter.

    :param letter: A letter from the outbox fixture.
    :param content_type: The content type of the part.
    :return: The decoded part.
    """
    for part in letter.walk():
        if part.get_content_type() == content_type:
            payload: object = part.get_payload(decode=True)
            assert isinstance(payload, bytes)
            return payload.decode(encoding=part.get_content_charset() or "utf-8")
    raise AssertionError(f"The letter has no {content_type} part")


def html_of(letter: EmailMessage) -> str:
    """
    The HTML body of a recorded letter.

    :param letter: A letter from the outbox fixture.
    :return: The decoded HTML.
    """
    return _body_of(letter=letter, content_type="text/html")


def text_of(letter: EmailMessage) -> str:
    """
    The plain text body of a recorded letter.

    :param letter: A letter from the outbox fixture.
    :return: The decoded text.
    """
    return _body_of(letter=letter, content_type="text/plain")
