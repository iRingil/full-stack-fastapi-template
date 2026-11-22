"""
Tests for src/app/core/config.py: the settings groups, their field types and get_settings.

The groups read the environment of the tests (tests/conftest.py) and no .env file unless a test passes one.
"""

# ruff: noqa: S101

from pathlib import Path

import pytest
from pydantic import AnyHttpUrl, HttpUrl, SecretStr, ValidationError

# noinspection PyProtectedMember
from app.core.config import (
    AppSettings,
    PostgresSettings,
    SecuritySettings,
    Settings,
    SmtpSettings,
    SuperuserSettings,
    _load,
    get_settings,
)

__all__: tuple[str, ...] = ()


class TestSettings:
    """Tests for the whole settings."""

    def test_groups_read_their_prefixed_variables(self) -> None:
        """
        Each group takes its own environment variables, the superuser email included (it has no prefix).

        :return: None
        """
        settings: Settings = Settings()
        assert settings.app.project_name == "Test Project"
        assert settings.postgres.server == "127.0.0.1"
        assert settings.postgres.db == "test_db"
        assert settings.superuser.email == "admin@example.com"
        assert settings.security.access_token_expire_minutes == 60 * 24 * 8

    def test_environment_is_required(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Without ENVIRONMENT the settings do not load.

        A server must never fall back to "local": the API docs, the debug mode and the unauthenticated private router.

        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        monkeypatch.delenv(name="ENVIRONMENT")
        with pytest.raises(ValidationError, match="environment"):
            _load(cls=AppSettings)

    def test_sender_name_defaults_to_the_project_name(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Without a sender name the project name is used; a given name is kept.

        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        assert Settings().email.from_name == "Test Project"
        monkeypatch.setenv(name="EMAILS_FROM_NAME", value="Robot")
        assert Settings().email.from_name == "Robot"

    def test_emails_enabled_needs_a_host_and_a_sender(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Emails are enabled only with both an SMTP host and a sender address.

        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        assert Settings().emails_enabled is False
        monkeypatch.setenv(name="SMTP_HOST", value="smtp.example.com")
        assert Settings().emails_enabled is False
        monkeypatch.setenv(name="EMAILS_FROM_EMAIL", value="noreply@example.com")
        assert Settings().emails_enabled is True

    def test_get_settings_is_a_singleton(self) -> None:
        """
        get_settings always returns the same settings.

        :return: None
        """
        assert get_settings() is get_settings()


class TestAppSettings:
    """Tests for AppSettings."""

    @pytest.mark.parametrize(
        argnames="origins",
        argvalues=["http://a.example, http://b.example/", '["http://a.example", "http://b.example/"]'],
        ids=["comma-separated", "json-list"],
    )
    def test_cors_from_the_environment(self, monkeypatch: pytest.MonkeyPatch, origins: str) -> None:
        """
        A comma-separated string and a JSON list both work; the frontend is always added; no trailing slashes.

        :param monkeypatch: pytest's monkeypatch fixture.
        :param origins: The raw value of the variable.
        :return: None
        """
        monkeypatch.setenv(name="BACKEND_CORS_ORIGINS", value=origins)
        assert _load(cls=AppSettings).all_cors_origins == [
            "http://a.example",
            "http://b.example",
            "http://localhost:5173",
        ]

    def test_cors_from_a_list(self) -> None:
        """
        A real list is taken as is.

        :return: None
        """
        app: AppSettings = AppSettings(
            project_name="P", environment="local", backend_cors_origins=[AnyHttpUrl("http://a.example")]
        )
        assert app.all_cors_origins == ["http://a.example", "http://localhost:5173"]

    def test_cors_origins_must_be_urls(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        A CORS origin that is not an HTTP URL is rejected.

        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        monkeypatch.setenv(name="BACKEND_CORS_ORIGINS", value="not a url")
        with pytest.raises(ValidationError):
            _load(cls=AppSettings)

    def test_frontend_url_has_no_trailing_slash(self) -> None:
        """
        The frontend address to build links from has no trailing slash, whatever was configured.

        :return: None
        """
        assert (
            AppSettings(
                project_name="P", environment="local", frontend_host=HttpUrl("https://example.com/")
            ).frontend_url
            == "https://example.com"
        )


class TestPostgresSettings:
    """Tests for PostgresSettings and the host and port types."""

    @pytest.mark.parametrize(
        argnames="server",
        argvalues=["127.0.0.1", "::1", "fe80::1%eth0", "localhost", "db.example.com", "db-1.internal"],
    )
    def test_accepts_ip_addresses_and_host_names(self, server: str) -> None:
        """
        An IPv4 address, an IPv6 address or a host name is a valid server.

        :param server: The server.
        :return: None
        """
        assert PostgresSettings(server=server, user="u", db="d").server == server

    @pytest.mark.parametrize(
        argnames="server",
        argvalues=["", "db example.com", "-db.example.com", "db..example.com", "http://db.example.com", "a" * 64],
    )
    def test_rejects_anything_else(self, server: str) -> None:
        """
        A value that is neither an IP address nor a host name is rejected.

        :param server: The server.
        :return: None
        """
        with pytest.raises(ValidationError, match="neither an IP address nor a valid host name"):
            PostgresSettings(server=server, user="u", db="d")

    @pytest.mark.parametrize(argnames="port", argvalues=[0, 65536])
    def test_port_range(self, port: int) -> None:
        """
        A port outside 1-65535 is rejected.

        :param port: The port.
        :return: None
        """
        with pytest.raises(ValidationError):
            PostgresSettings(server="db.example.com", port=port, user="u", db="d")

    def test_reads_the_env_file(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """
        A group reads its prefixed variables from the .env file when the environment does not have them.

        :param monkeypatch: pytest's monkeypatch fixture.
        :param tmp_path: A temporary directory.
        :return: None
        """
        env_file: Path = tmp_path / ".env"
        env_file.write_text("POSTGRES_SERVER=db.example.com\nPOSTGRES_PORT=6432\n", encoding="utf-8")
        monkeypatch.delenv(name="POSTGRES_SERVER")
        monkeypatch.delenv(name="POSTGRES_PORT")
        # PyCharm does not take a TypedDict for a Mapping (basedpyright checks it)
        # noinspection PyTypeChecker
        monkeypatch.setitem(PostgresSettings.model_config, "env_file", env_file)
        postgres: PostgresSettings = _load(cls=PostgresSettings)
        assert (postgres.server, postgres.port) == ("db.example.com", 6432)


class TestSecrets:
    """Tests for the limits of the secrets."""

    def test_secret_key_is_long_enough_for_hs256(self) -> None:
        """
        A signing key shorter than 32 characters is rejected.

        :return: None
        """
        with pytest.raises(ValidationError):
            SecuritySettings(secret_key=SecretStr("too-short"))

    @pytest.mark.parametrize(argnames="password", argvalues=["short", "x" * 73])
    def test_superuser_password_follows_the_user_password_limits(
        self, monkeypatch: pytest.MonkeyPatch, password: str
    ) -> None:
        """
        The first superuser's password must fit the limits of any user password (8-72 characters).

        :param monkeypatch: pytest's monkeypatch fixture.
        :param password: The password.
        :return: None
        """
        monkeypatch.setenv(name="FIRST_SUPERUSER_PASSWORD", value=password)
        with pytest.raises(ValidationError):
            _load(cls=SuperuserSettings)


def test_smtp_tls_and_ssl_together() -> None:
    """
    STARTTLS and SSL cannot be enabled at once.

    :return: None
    """
    with pytest.raises(ValidationError, match="SMTP_TLS and SMTP_SSL cannot both be True"):
        SmtpSettings(tls=True, ssl=True)
