"""Tests for src/app/api/main.py (MainRouter): which routers are included in which environment."""

# ruff: noqa: S101

from fastapi import FastAPI

from app.api.main import MainRouter
from app.core.config import Settings
from tests.conftest import with_settings

__all__: tuple[str, ...] = ()


def _paths(settings: Settings) -> set[str]:
    """
    The paths of the main router built with the given settings, as an application publishes them.

    :param settings: The settings to build the router with.
    :return: The route paths.
    """
    application: FastAPI = FastAPI()
    application.include_router(router=MainRouter(settings=settings).router)
    paths: dict[str, object] = application.openapi()["paths"]
    return set(paths)


class TestMainRouter:
    """Tests for MainRouter."""

    def test_local_includes_the_private_router(self, settings: Settings) -> None:
        """
        In the local environment all routers, the private one included, are there.

        :param settings: The test settings (local environment).
        :return: None
        """
        paths: set[str] = _paths(settings=settings)
        assert {"/login/access-token", "/users/me", "/utils/health-check/", "/items/", "/private/users/"} <= paths

    def test_other_environments_exclude_the_private_router(self, settings: Settings) -> None:
        """
        Outside the local environment the private router is left out.

        :param settings: The test settings.
        :return: None
        """
        paths: set[str] = _paths(settings=with_settings(settings=settings, group="app", environment="production"))
        assert "/users/me" in paths
        assert "/private/users/" not in paths
