"""Module for configuring application middleware."""

from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import TYPE_CHECKING, override

from fastapi import FastAPI
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.config import Settings
from app.core.db import DatabaseManager
from app.core.log_setup import describe_exception

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

__all__: tuple[str, ...] = ("MiddlewareConfigurator",)


class DbSessionMiddleware(BaseHTTPMiddleware):
    """Middleware for managing database sessions per request."""

    def __init__(self, app: ASGIApp, db_manager: DatabaseManager) -> None:
        """
        Initializes the middleware.

        :param app: The ASGI application.
        :param db_manager: The database manager instance.
        """
        super().__init__(app)
        self.db_manager: DatabaseManager = db_manager

    @override
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """
        Handles the request and ensures session management and general exception handling.

        :param request: The incoming HTTP request.
        :param call_next: The function to call to process the request.
        :return: The HTTP response.
        """
        session_generator: AsyncGenerator[AsyncSession] = self.db_manager.get_session()
        session: AsyncSession = await anext(session_generator)
        try:
            response: Response = await call_next(request)
        except Exception as exc:  # noqa: BLE001 - the last line of defence: log any error and answer 500
            logger.error(f"{request.method} {request.url.path} failed: {describe_exception(exc=exc)}")
            if request.scope.get("client"):
                return Response(content="Internal Server Error", status_code=500)
            # For requests without a client (like webhooks), avoid sending a body.
            return Response(status_code=204)
        finally:
            await session.close()
        return response


class MiddlewareConfigurator:
    """A class to configure and add all middleware to the application."""

    def __init__(self, app: FastAPI, settings: Settings, db_manager: DatabaseManager) -> None:
        """
        Initializes the MiddlewareConfigurator.

        :param app: The FastAPI application instance.
        :param settings: The application settings.
        :param db_manager: The database manager instance.
        """
        self._app: FastAPI = app
        self._settings: Settings = settings
        self._db_manager: DatabaseManager = db_manager

    def add_all_middleware(self) -> None:
        """
        Adds all configured middleware to the application.

        :return: None
        """
        self._app.add_middleware(
            DbSessionMiddleware,
            db_manager=self._db_manager,
        )
        if self._settings.app.all_cors_origins:
            self._app.add_middleware(
                CORSMiddleware,
                allow_origins=[str(origin) for origin in self._settings.app.all_cors_origins],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
