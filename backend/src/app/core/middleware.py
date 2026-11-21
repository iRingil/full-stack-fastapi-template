"""Module for configuring application middleware."""

from collections.abc import AsyncGenerator, Awaitable, Callable
from pathlib import Path
from traceback import FrameSummary, extract_tb
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

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

__all__: tuple[str, ...] = ("MiddlewareConfigurator",)

_APP_DIR: Path = Path(__file__).resolve().parents[1]


def _describe_exception(exc: BaseException) -> str:
    """
    Describes an exception in one line: its type, the first line of its message and where in the project it occurred.

    :param exc: The exception to describe.
    :return: A line like 'IntegrityError: ... (app/crud/base.py:120 in create)'.
    """
    frames: list[FrameSummary] = extract_tb(tb=exc.__traceback__)
    # The deepest frame of the project's own code; library frames say little about what went wrong
    own_frames: list[FrameSummary] = [
        frame for frame in frames if Path(frame.filename).resolve().is_relative_to(_APP_DIR)
    ]
    location: str = ""
    if origin := (own_frames or frames)[-1:]:
        frame: FrameSummary = origin[0]
        try:
            file_name: str = Path(frame.filename).resolve().relative_to(_APP_DIR.parent).as_posix()
        except ValueError:
            file_name = frame.filename
        location = f" ({file_name}:{frame.lineno} in {frame.name})"
    message: str = str(exc).strip().splitlines()[0] if str(exc).strip() else ""
    return f"{type(exc).__name__}: {message}{location}"


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
            logger.error(f"{request.method} {request.url.path} failed: {_describe_exception(exc=exc)}")
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
        if self._settings.all_cors_origins:
            self._app.add_middleware(
                CORSMiddleware,
                allow_origins=[str(origin) for origin in self._settings.all_cors_origins],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
