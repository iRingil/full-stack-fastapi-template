"""Tests for src/app/core/security.py (SecurityManager): passwords and access tokens."""

# ruff: noqa: PLR2004, S101, S106

from datetime import timedelta

import bcrypt
import jwt
import pytest

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

    def test_password_over_72_bytes_is_never_truncated(self, security_manager: SecurityManager) -> None:
        """
        A password over the 72 bytes of bcrypt (here Cyrillic, 2 bytes a letter) is not cut down to fit.

        It cannot be hashed (the models reject it before), and it does not match the hash of its first 72 bytes.

        :param security_manager: The test security manager.
        :return: None
        """
        password: str = "пароль" * 20
        with pytest.raises(ValueError, match="72 bytes"):
            security_manager.get_password_hash(password=password)
        hashed: str = security_manager.get_password_hash(password=password[:36])
        assert security_manager.verify_password(plain_password=password[:36], hashed_password=hashed)
        assert not security_manager.verify_password(plain_password=password, hashed_password=hashed)

    def test_dummy_password_check_takes_a_real_hash(
        self, security_manager: SecurityManager, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        The check for a missing user runs bcrypt against a hash made once and kept.

        :param security_manager: The test security manager.
        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        checked: list[bytes] = []
        real_checkpw = bcrypt.checkpw

        def checkpw(password: bytes, hashed_password: bytes) -> bool:
            """
            Records the hash and runs the real check.

            :param password: The password.
            :param hashed_password: The hash.
            :return: The result of the real check.
            """
            checked.append(hashed_password)
            return real_checkpw(password=password, hashed_password=hashed_password)

        monkeypatch.setattr(target=bcrypt, name="checkpw", value=checkpw)
        security_manager.verify_dummy_password(plain_password="password123")
        security_manager.verify_dummy_password(plain_password="password124")
        assert len(checked) == 2
        assert checked[0] == checked[1]
        assert checked[0].startswith(b"$2b$")

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
    An access token carries the subject, the token version and an expiry, signed with the application key.

    :param settings: The test settings.
    :param security_manager: The test security manager.
    :return: None
    """
    token: str = security_manager.create_access_token(subject="user-id", expires_delta=timedelta(minutes=5), version=2)
    payload: dict[str, object] = jwt.decode(
        jwt=token, key=settings.security.secret_key.get_secret_value(), algorithms=[SecurityManager.ALGORITHM]
    )
    assert payload["sub"] == "user-id"
    assert payload["ver"] == 2
    assert "exp" in payload


def test_get_security_manager_is_a_singleton() -> None:
    """
    get_security_manager always returns the same manager.

    :return: None
    """
    assert get_security_manager() is get_security_manager()
