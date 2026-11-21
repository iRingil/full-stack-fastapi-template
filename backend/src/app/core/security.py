"""Provides security-related services for the application, such as password hashing and JWT token creation."""

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import ClassVar

import bcrypt
import jwt

from app.core.config import Settings, get_settings

__all__: tuple[str, ...] = ("SecurityManager", "get_security_manager")


class SecurityManager:
    """Manages security operations like password hashing and JWT token handling."""

    ALGORITHM: ClassVar[str] = "HS256"
    # bcrypt uses only the first 72 bytes of a password; bcrypt>=5 raises instead of truncating silently
    _BCRYPT_MAX_BYTES: ClassVar[int] = 72

    def __init__(self, settings: Settings) -> None:
        """
        Initializes the security manager with necessary dependencies.

        :param settings: The application settings object.
        """
        self._settings: Settings = settings

    def create_access_token(self, subject: str, expires_delta: timedelta) -> str:
        """
        Creates a new JWT access token.

        :param subject: The subject of the token (the user ID).
        :param expires_delta: The lifespan of the token.
        :return: The encoded JWT token as a string.
        """
        expire: datetime = datetime.now(tz=UTC) + expires_delta
        to_encode: dict[str, datetime | str] = {"exp": expire, "sub": subject}
        return jwt.encode(
            payload=to_encode, key=self._settings.security.secret_key.get_secret_value(), algorithm=self.ALGORITHM
        )

    def _encode_password(self, password: str) -> bytes:
        """
        Encodes a password for bcrypt, truncated to 72 bytes as older bcrypt versions (and passlib) did.

        :param password: The plain text password.
        :return: The password bytes accepted by bcrypt.
        """
        return password.encode(encoding="utf-8")[: self._BCRYPT_MAX_BYTES]

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verifies a plain password against its hashed version.

        :param plain_password: The plain text password.
        :param hashed_password: The hashed password from the database.
        :return: True if the password is correct, False otherwise (including a malformed hash).
        """
        try:
            return bcrypt.checkpw(
                password=self._encode_password(password=plain_password),
                hashed_password=hashed_password.encode(encoding="utf-8"),
            )
        except ValueError:
            return False

    def get_password_hash(self, password: str) -> str:
        """
        Hashes a plain password.

        :param password: The plain text password to hash.
        :return: The hashed password as a string.
        """
        return bcrypt.hashpw(password=self._encode_password(password=password), salt=bcrypt.gensalt()).decode()


@lru_cache(maxsize=1)
def get_security_manager() -> SecurityManager:
    """
    Gets the SecurityManager object. The lru_cache decorator ensures this function is only called once.

    :return: An instance of SecurityManager.
    """
    return SecurityManager(settings=get_settings())
