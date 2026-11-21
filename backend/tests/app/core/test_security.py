"""Tests for src/app/core/security.py (SecurityManager): passwords and access tokens."""

# ruff: noqa: S101, S106

from datetime import timedelta

import bcrypt
import jwt

from app.core.config import Settings
from app.core.security import SecurityManager, get_security_manager

__all__: tuple[str, ...] = ()


class TestPasswords:
    """Tests for hashing and verifying passwords."""

    def test_hash_and_verify(self, security_manager: SecurityManager) -> None:
        """
        A hashed password verifies, another one does not.

        :param security_manager: The test security manager.
        :return: None
        """
        hashed: str = security_manager.get_password_hash(password="password123")
        assert security_manager.verify_password(plain_password="password123", hashed_password=hashed)
        assert not security_manager.verify_password(plain_password="password124", hashed_password=hashed)

    def test_long_password_is_truncated_to_72_bytes(self, security_manager: SecurityManager) -> None:
        """
        A password over 72 bytes (here Cyrillic, 2 bytes a letter) is hashed as its first 72 bytes, as bcrypt did.

        :param security_manager: The test security manager.
        :return: None
        """
        password: str = "пароль" * 20
        hashed: str = security_manager.get_password_hash(password=password)
        assert security_manager.verify_password(plain_password=password, hashed_password=hashed)
        assert security_manager.verify_password(plain_password=password[:36] + "x", hashed_password=hashed)

    def test_hash_of_another_bcrypt_library(self, security_manager: SecurityManager) -> None:
        """
        A hash made elsewhere with bcrypt (as passlib stored them) still verifies.

        :param security_manager: The test security manager.
        :return: None
        """
        hashed: str = bcrypt.hashpw(password=b"password123", salt=bcrypt.gensalt()).decode()
        assert security_manager.verify_password(plain_password="password123", hashed_password=hashed)

    def test_malformed_hash(self, security_manager: SecurityManager) -> None:
        """
        A malformed hash does not verify instead of raising.

        :param security_manager: The test security manager.
        :return: None
        """
        assert not security_manager.verify_password(plain_password="password123", hashed_password="not-a-hash")


def test_access_token(settings: Settings, security_manager: SecurityManager) -> None:
    """
    An access token carries the subject and an expiry, signed with the application key.

    :param settings: The test settings.
    :param security_manager: The test security manager.
    :return: None
    """
    token: str = security_manager.create_access_token(subject="user-id", expires_delta=timedelta(minutes=5))
    payload: dict[str, object] = jwt.decode(
        jwt=token, key=settings.security.secret_key.get_secret_value(), algorithms=[SecurityManager.ALGORITHM]
    )
    assert payload["sub"] == "user-id"
    assert "exp" in payload


def test_get_security_manager_is_a_singleton() -> None:
    """
    get_security_manager always returns the same manager.

    :return: None
    """
    assert get_security_manager() is get_security_manager()
