"""Provides security-related services for the application, such as password hashing and JWT token creation."""

from datetime import UTC, datetime, timedelta
from functools import cached_property, lru_cache
from typing import ClassVar

import bcrypt
import jwt

from app.core.config import Settings, get_settings

__all__: tuple[str, ...] = ("SecurityManager", "get_security_manager")


class SecurityManager:
    """Manages security operations like password hashing and JWT token handling."""

    ALGORITHM: ClassVar[str] = "HS256"
    # The claim with User.token_version: a token of another version is revoked
    VERSION_CLAIM: ClassVar[str] = "ver"

    def __init__(self, settings: Settings) -> None:
        """
        Initializes the security manager with necessary dependencies.

        :param settings: The application settings object.
        """
        self._settings: Settings = settings

    def create_access_token(self, subject: str, expires_delta: timedelta, version: int = 0) -> str:
        """
        Creates a new JWT access token.

        :param subject: The subject of the token (the user ID).
        :param expires_delta: The lifespan of the token.
        :param version: The token version of the user (User.token_version) at the time of issue.
        :return: The encoded JWT token as a string.
        """
        expire: datetime = datetime.now(tz=UTC) + expires_delta
        to_encode: dict[str, datetime | int | str] = {"exp": expire, "sub": subject, self.VERSION_CLAIM: version}
        return jwt.encode(
            payload=to_encode, key=self._settings.security.secret_key.get_secret_value(), algorithm=self.ALGORITHM
        )

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verifies a plain password against its hashed version.

        bcrypt takes at most 72 bytes and the password is never truncated: a longer one does not match.

        :param plain_password: The plain text password.
        :param hashed_password: The hashed password from the database.
        :return: True if the password is correct, False otherwise (including a malformed hash).
        """
        try:
            return bcrypt.checkpw(
                password=plain_password.encode(encoding="utf-8"),
                hashed_password=hashed_password.encode(encoding="utf-8"),
            )
        except ValueError:
            return False

    def verify_dummy_password(self, plain_password: str) -> None:
        """
        Spends the time of a real password check when there is no user to check against.

        Without it a login with an unknown email answers much faster than one with a wrong password, which reveals
        the registered addresses.

        :param plain_password: The password from the login form.
        :return: None
        """
        self.verify_password(plain_password=plain_password, hashed_password=self._dummy_hash)

    @cached_property
    def _dummy_hash(self) -> str:
        """
        The hash that a login with an unknown email is checked against, made on first use.

        :return: The bcrypt hash of a password nobody has.
        """
        return self.get_password_hash(password="a-password-nobody-has")  # noqa: S106 - not a secret

    @staticmethod
    def get_password_hash(password: str) -> str:
        """
        Hashes a plain password.

        :param password: The plain text password to hash, at most 72 bytes in UTF-8 (the models validate it).
        :return: The hashed password as a string.
        """
        return bcrypt.hashpw(password=password.encode(encoding="utf-8"), salt=bcrypt.gensalt()).decode()


@lru_cache(maxsize=1)
def get_security_manager() -> SecurityManager:
    """
    Gets the SecurityManager object. The lru_cache decorator ensures this function is only called once.

    :return: An instance of SecurityManager.
    """
    return SecurityManager(settings=get_settings())
