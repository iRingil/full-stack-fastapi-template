"""Constants of the application: values defined by the code, not by a deployment."""

from pathlib import Path
from typing import Final

__all__: tuple[str, ...] = ("API_V1_STR", "BASE_DIR", "ENV_FILE")

# The prefix of all API routes; the generated frontend client depends on it
API_V1_STR: Final[str] = "/api/v1"
# backend/src: the root of the application package, its templates and its logs
BASE_DIR: Final[Path] = Path(__file__).resolve().parents[2]
# The settings file of a deployment; environment variables take precedence over it
ENV_FILE: Final[Path] = BASE_DIR / ".env"
