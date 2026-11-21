"""Tests for src/app/core/config.py: Settings validation and get_settings."""

# ruff: noqa: S101, S106

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings

__all__: tuple[str, ...] = ()


def _settings(**overrides: object) -> Settings:
    """
    Builds settings from the test environment (tests/conftest.py) and the given overrides, without a .env file.

    :param overrides: Field values that take precedence over the environment.
    :return: The settings.
    """
    return Settings(_env_file=None, **overrides)  # pyright: ignore[reportCallIssue] - the required fields come from the environment


class TestCors:
    """Tests for BACKEND_CORS_ORIGINS parsing and all_cors_origins."""

    def test_comma_separated_string(self) -> None:
        """
        A comma-separated string is split; the frontend host is always added, without a trailing slash.

        :return: None
        """
        settings: Settings = _settings(BACKEND_CORS_ORIGINS="http://a.example, http://b.example/")
        assert settings.all_cors_origins == ["http://a.example", "http://b.example", "http://localhost:5173"]

    def test_json_list_in_the_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        A JSON list in the environment (or the .env file) is parsed by pydantic-settings before the validator.

        :param monkeypatch: pytest's monkeypatch fixture.
        :return: None
        """
        monkeypatch.setenv(name="BACKEND_CORS_ORIGINS", value='["http://a.example"]')
        assert _settings().all_cors_origins == ["http://a.example", "http://localhost:5173"]

    def test_list(self) -> None:
        """
        A real list is taken as is.

        :return: None
        """
        assert _settings(BACKEND_CORS_ORIGINS=["http://a.example"]).all_cors_origins == [
            "http://a.example",
            "http://localhost:5173",
        ]


class TestEmails:
    """Tests for the email settings."""

    def test_tls_and_ssl_together(self) -> None:
        """
        STARTTLS and SSL cannot be enabled at once.

        :return: None
        """
        with pytest.raises(ValidationError, match="SMTP_TLS and SMTP_SSL cannot both be True"):
            _settings(SMTP_TLS=True, SMTP_SSL=True)

    def test_sender_name_defaults_to_the_project_name(self) -> None:
        """
        Without EMAILS_FROM_NAME the project name is used; a given name is kept.

        :return: None
        """
        assert _settings().EMAILS_FROM_NAME == "Test Project"
        assert _settings(EMAILS_FROM_NAME="Robot").EMAILS_FROM_NAME == "Robot"

    def test_emails_enabled_needs_a_host_and_a_sender(self) -> None:
        """
        Emails are enabled only with both an SMTP host and a sender address.

        :return: None
        """
        assert _settings().emails_enabled is False
        assert _settings(SMTP_HOST="smtp.example.com").emails_enabled is False
        assert _settings(SMTP_HOST="smtp.example.com", EMAILS_FROM_EMAIL="noreply@example.com").emails_enabled


class TestDefaultSecrets:
    """Tests for the 'changethis' placeholder check."""

    def test_warns_in_the_local_environment(self) -> None:
        """
        Locally a placeholder secret only gives a warning.

        :return: None
        """
        with pytest.warns(UserWarning, match="SECRET_KEY is 'changethis'"):
            _settings(SECRET_KEY="changethis")

    def test_fails_elsewhere(self) -> None:
        """
        Outside the local environment a placeholder secret is an error.

        :return: None
        """
        with pytest.raises(ValidationError, match="POSTGRES_PASSWORD is 'changethis'"):
            _settings(ENVIRONMENT="production", POSTGRES_PASSWORD="changethis")


class TestGetSettings:
    """Tests for get_settings."""

    def test_reads_the_env_file(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """
        get_settings reads the given .env file (environment variables would take precedence) and caches the result.

        :param monkeypatch: pytest's monkeypatch fixture.
        :param tmp_path: A temporary directory.
        :return: None
        """
        env_file: Path = tmp_path / ".env"
        env_file.write_text('PROJECT_NAME="From File"\n', encoding="utf-8")
        monkeypatch.delenv(name="PROJECT_NAME")
        settings: Settings = get_settings(env_file=env_file)
        assert settings.PROJECT_NAME == "From File"
        assert get_settings(env_file=env_file) is settings
