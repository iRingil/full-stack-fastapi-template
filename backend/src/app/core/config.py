"""
Configuration of a deployment, read from the environment and the .env file.

The settings are split into groups, one BaseSettings class each, with the prefix of their environment variables.
A field without a default must be set in the environment (secrets and server-specific values); a field with a
default may be overridden but rarely needs to be. Values defined by the code are constants (app.core.constants).
"""

import re
from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from typing import Annotated, ClassVar, Literal, Self

from pydantic import (
    AfterValidator,
    AnyHttpUrl,
    BaseModel,
    BeforeValidator,
    EmailStr,
    Field,
    HttpUrl,
    PositiveInt,
    SecretStr,
    TypeAdapter,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.constants import ENV_FILE

__all__: tuple[str, ...] = (
    "AppSettings",
    "EmailSettings",
    "PostgresSettings",
    "SecuritySettings",
    "Settings",
    "SmtpSettings",
    "SuperuserSettings",
    "get_settings",
)

_STRING_LIST: TypeAdapter[list[str]] = TypeAdapter(list[str])
# A host name by RFC 1123: dot-separated labels of letters, digits and inner hyphens, at most 253 characters
_HOSTNAME: re.Pattern[str] = re.compile(
    r"(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*", re.IGNORECASE
)


def _validate_host(value: str) -> str:
    """
    Accepts an IPv4 address, an IPv6 address or a host name.

    :param value: The host.
    :return: The host unchanged.
    :raises ValueError: If the value is neither an IP address nor a valid host name.
    """
    try:
        ip_address(value)
    except ValueError:
        if not _HOSTNAME.fullmatch(value):
            raise ValueError(f"'{value}' is neither an IP address nor a valid host name") from None
    return value


def _parse_cors(value: list[str] | str) -> list[str]:
    """
    Parses the CORS origins: a JSON list or a comma-separated string (a list is taken as is).

    :param value: List of strings, a JSON list string or a comma-separated string.
    :return: List of strings.
    """
    if isinstance(value, list):
        return value
    if value.startswith("["):
        return _STRING_LIST.validate_json(value)
    return [item.strip() for item in value.split(",")]


type Host = Annotated[str, AfterValidator(_validate_host)]
type Port = Annotated[int, Field(gt=0, le=65535)]


def _config(prefix: str) -> SettingsConfigDict:
    """
    The configuration shared by all settings groups.

    :param prefix: The prefix of the group's environment variables.
    :return: The configuration.
    """
    return SettingsConfigDict(env_prefix=prefix, env_file=ENV_FILE, env_ignore_empty=True, extra="ignore")


class AppSettings(BaseSettings):
    """The deployment itself: its name, environment and the frontend it serves."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="")

    project_name: str
    environment: Literal["local", "staging", "production"] = "local"
    frontend_host: HttpUrl = HttpUrl("http://localhost:5173")
    # NoDecode: the raw string goes to _parse_cors, which also takes a comma-separated list, not only JSON
    backend_cors_origins: Annotated[list[AnyHttpUrl], NoDecode, BeforeValidator(_parse_cors)] = []

    @property
    def frontend_url(self) -> str:
        """
        The frontend address without a trailing slash, to build links from.

        :return: The address.
        """
        return str(self.frontend_host).rstrip("/")

    @property
    def all_cors_origins(self) -> list[str]:
        """
        All CORS origins: the configured ones and the frontend, without trailing slashes.

        :return: The origins.
        """
        return [str(origin).rstrip("/") for origin in self.backend_cors_origins] + [self.frontend_url]


class SecuritySettings(BaseSettings):
    """The signing key and the lifetimes of the tokens."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="")

    secret_key: SecretStr = Field(min_length=32)  # HS256 needs at least 32 bytes
    access_token_expire_minutes: PositiveInt = 60 * 24 * 8  # 8 days
    email_reset_token_expire_hours: PositiveInt = 48
    email_verify_token_expire_hours: PositiveInt = 24


class SuperuserSettings(BaseSettings):
    """The first superuser, created by app.initial_data."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="FIRST_SUPERUSER_")

    email: EmailStr = Field(validation_alias="FIRST_SUPERUSER")
    password: SecretStr = Field(min_length=8, max_length=40)  # the limits of a user password


class PostgresSettings(BaseSettings):
    """The connection to PostgreSQL: host and port, or a Unix socket in production."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="POSTGRES_")

    server: Host
    port: Port = 5432
    socket: Path | None = None
    user: str
    password: SecretStr | None = None
    db: str


class SmtpSettings(BaseSettings):
    """The SMTP server; without a host emails are not sent."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="SMTP_")

    host: Host | None = None
    port: Port = 587
    user: str | None = None
    password: SecretStr | None = None
    tls: bool = True
    ssl: bool = False

    @model_validator(mode="after")
    def _validate_tls_ssl(self) -> Self:
        """
        Ensures STARTTLS and SSL are not both enabled.

        :return: The instance of the model.
        :raises ValueError: If both tls and ssl are True.
        """
        if self.tls and self.ssl:
            raise ValueError("SMTP_TLS and SMTP_SSL cannot both be True.")
        return self


class EmailSettings(BaseSettings):
    """The sender of the emails; without an address emails are not sent."""

    model_config: ClassVar[SettingsConfigDict] = _config(prefix="EMAILS_")

    from_email: EmailStr | None = None
    from_name: str | None = None  # the project name by default


def _load[T: BaseSettings](cls: type[T]) -> T:
    """
    Reads a settings group from the environment and the .env file.

    Called through the BaseSettings signature, where every argument is optional: the required fields of a group
    come from the environment, which static analysis cannot know.

    :param cls: The settings group.
    :return: The settings.
    """
    return cls()


class Settings(BaseModel):
    """
    All settings of a deployment, by group.

    A plain model: each group reads its own environment variables, the whole reads none (it would otherwise take
    variables named like the groups, APP or EMAIL, for JSON).
    """

    app: AppSettings = Field(default_factory=lambda: _load(cls=AppSettings))
    security: SecuritySettings = Field(default_factory=lambda: _load(cls=SecuritySettings))
    superuser: SuperuserSettings = Field(default_factory=lambda: _load(cls=SuperuserSettings))
    postgres: PostgresSettings = Field(default_factory=lambda: _load(cls=PostgresSettings))
    smtp: SmtpSettings = Field(default_factory=lambda: _load(cls=SmtpSettings))
    email: EmailSettings = Field(default_factory=lambda: _load(cls=EmailSettings))

    @model_validator(mode="after")
    def _set_default_sender_name(self) -> Self:
        """
        Names the sender after the project when no name is set.

        :return: The instance of the model.
        """
        if not self.email.from_name:
            self.email.from_name = self.app.project_name
        return self

    @property
    def emails_enabled(self) -> bool:
        """
        Whether emails can be sent: both an SMTP host and a sender address are set.

        :return: True if email sending is enabled.
        """
        return bool(self.smtp.host and self.email.from_email)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Returns the settings. The lru_cache decorator ensures they are read only once.

    :return: The settings.
    """
    return Settings()
