"""Configuration for the application."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self
from warnings import warn

from pydantic import AnyUrl, BeforeValidator, EmailStr, Field, SecretStr, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__: tuple[str, ...] = ("Settings", "get_settings")


class Settings(BaseSettings):
    """Class for application settings."""

    # Common parameters
    PROJECT_NAME: str
    BASE_DIR: Path = Path(__file__).resolve().parents[2]
    model_config = SettingsConfigDict(env_ignore_empty=True, extra="ignore")
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    # Secrets
    SECRET_KEY: SecretStr
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 60 minutes * 24 hours * 8 days = 8 days

    # Admin user
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: SecretStr

    # CORS
    @staticmethod
    def _parse_cors(v: list[str] | str) -> list[str] | str:
        """
        Helper to parse a comma-separated string into a list of strings.

        :param v: List of strings or comma-separated string.
        :return: List of strings or original value.
        :raises ValueError: If the value is neither a string nor a list.
        """
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        if isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        """
        Constructs a list of all CORS origins, including backend and frontend hosts.

        :return: A list of strings representing the origins allowed for CORS.
        """
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [self.FRONTEND_HOST]

    API_V1_STR: str = "/api/v1"
    FRONTEND_HOST: str = "http://localhost:5173"
    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(_parse_cors)] = []

    # Postgres database
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = Field(default=5432, gt=0, le=65535)
    POSTGRES_SOCKET: str | None = None
    POSTGRES_USER: str
    POSTGRES_PASSWORD: SecretStr = SecretStr("")
    POSTGRES_DB: str = ""

    # Email
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = Field(default=587, gt=0, le=65535)
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: SecretStr | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48
    EMAIL_VERIFY_TOKEN_EXPIRE_HOURS: int = 24
    EMAIL_TEST_USER: EmailStr = "test@example.com"

    @model_validator(mode="after")
    def _validate_smtp_tls_ssl(self) -> Self:
        """
        Ensures SMTP_TLS and SMTP_SSL are not both enabled simultaneously.

        :return: The instance of the model.
        :raises ValueError: If both SMTP_TLS and SMTP_SSL are True.
        """
        if self.SMTP_TLS and self.SMTP_SSL:
            raise ValueError("SMTP_TLS and SMTP_SSL cannot both be True.")
        return self

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        """
        Sets default value for EMAILS_FROM_NAME if it is not set.

        :return: The instance of the model.
        """
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        """
        Checks if email sending is enabled.

        :return: True if email sending is enabled, False otherwise.
        """
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    # Security checks
    def _check_default_secret(self, var_name: str, value: SecretStr) -> None:
        """
        Checks if the given secret value is set to the default placeholder 'changethis'.

        :param var_name: The name of the variable being checked.
        :param value: The value of the secret to be checked.
        :return: None
        :raises ValueError: If the value is set to the default placeholder and the environment is not 'local'.
        """
        if value.get_secret_value() == "changethis":
            message: str = f"The value of {var_name} is 'changethis', for security, please change it."
            if self.ENVIRONMENT == "local":
                warn(message=message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        """
        Checks if the default secret values are set to the default placeholders in the local environment.

        :return: The instance of the model.
        """
        self._check_default_secret(var_name="SECRET_KEY", value=self.SECRET_KEY)
        self._check_default_secret(var_name="POSTGRES_PASSWORD", value=self.POSTGRES_PASSWORD)
        self._check_default_secret(var_name="FIRST_SUPERUSER_PASSWORD", value=self.FIRST_SUPERUSER_PASSWORD)
        return self


@lru_cache(maxsize=1)
def get_settings(env_file: Path = Path(__file__).resolve().parents[2] / ".env") -> Settings:
    """
    Returns the Settings object. The lru_cache decorator ensures this function is only called once.

    :param env_file: Path to the .env file. Defaults to the standard .env location.
    :return: Settings object.
    """
    return Settings(_env_file=env_file)  # type: ignore[call-arg]
