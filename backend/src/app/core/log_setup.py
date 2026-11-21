"""
Module for configuring logging in the application.

Every log line is 'module:Class.method:line | message'. An exception never produces a traceback: it is described
in one line - its type, the first line of its message and the place in the project's own code where it occurred.
"""

import inspect
import logging
from pathlib import Path
from sys import stderr
from traceback import walk_tb
from types import FrameType
from typing import TYPE_CHECKING, override

from loguru import logger
from sqlalchemy.exc import StatementError

if TYPE_CHECKING:
    from loguru import Record

__all__: tuple[str, ...] = ("InterceptHandler", "LoggingManager", "describe_exception")

_PROJECT_PACKAGE: str = "app"
_LOCATION_FORMAT: str = "{name}:{extra[qualname]}:{line}"


def _frame_location(*, frame: FrameType, lineno: int) -> str:
    """
    Describes a place in the code as 'module:Class.method:line'.

    :param frame: The frame of the place.
    :param lineno: The line number in the frame.
    :return: The description.
    """
    module_name: str = module.__name__ if (module := inspect.getmodule(frame)) else frame.f_code.co_filename
    return f"{module_name}:{frame.f_code.co_qualname}:{lineno}"


def _is_project_frame(frame: FrameType) -> bool:
    """
    Whether a frame belongs to the project's own code (the app package).

    :param frame: The frame.
    :return: True for the project's code.
    """
    module_name: str = module.__name__ if (module := inspect.getmodule(frame)) else ""
    return module_name == _PROJECT_PACKAGE or module_name.startswith(f"{_PROJECT_PACKAGE}.")


def describe_exception(exc: BaseException) -> str:
    """
    Describes an exception in one line: its type, the first line of its message and where in the project it occurred.

    For a SQLAlchemy statement error the message is the database driver's own one (asyncpg's, behind the DBAPI
    adapter of SQLAlchemy), without the SQL text and the parameters. The place is the deepest frame of the project's
    own code; library frames say little about what went wrong, so they are used only when the project's code is not
    in the traceback at all.

    :param exc: The exception to describe.
    :return: A line like 'IntegrityError: duplicate key value ... (app.crud.base:BaseCRUD.create:150)'.
    """
    source: BaseException = exc
    if isinstance(exc, StatementError) and isinstance(exc.orig, BaseException):
        source = exc.orig.__cause__ or exc.orig
    lines: list[str] = [line for line in str(source).splitlines() if line.strip()]
    message: str = lines[0].strip() if lines else ""
    frames: list[tuple[FrameType, int]] = list(walk_tb(tb=exc.__traceback__))
    own_frames: list[tuple[FrameType, int]] = [(frame, lineno) for frame, lineno in frames if _is_project_frame(frame)]
    origin: list[tuple[FrameType, int]] = (own_frames or frames)[-1:]
    location: str = f" ({_frame_location(frame=origin[0][0], lineno=origin[0][1])})" if origin else ""
    return f"{type(exc).__name__}: {message}{location}"


def _patch_record(record: "Record") -> None:
    """
    Completes a loguru record: the qualified name of the logging function, and a one-line exception.

    :param record: The record, changed in place.
    :return: None
    """
    path: str = record["file"].path
    frame: FrameType | None = inspect.currentframe()
    qualname: str = record["function"]
    while frame:
        code = frame.f_code
        if code.co_filename == path and frame.f_lineno == record["line"] and code.co_name == record["function"]:
            qualname = code.co_qualname
            break
        frame = frame.f_back
    record["extra"]["qualname"] = qualname
    exception = record["exception"]
    if exception and exception.value:
        record["message"] = f"{record['message']}: {describe_exception(exc=exception.value)}"
    # Never a traceback: the exception is in the message now
    record["exception"] = None


class InterceptHandler(logging.Handler):
    """Intercepts standard logging messages and redirects them to Loguru."""

    @override
    def emit(self, record: logging.LogRecord) -> None:
        """
        Redirects a standard logging message to Loguru, located at the code that logged it.

        :param record: Standard logging record.
        :return: None
        """
        try:
            level: str | int = logger.level(name=record.levelname).name
        except ValueError:
            level = record.levelno
        # Skip this handler's frame and the frames of the logging module to reach the caller
        frame: FrameType | None = inspect.currentframe()
        depth: int = 0
        while frame and (depth == 0 or frame.f_code.co_filename == logging.__file__):
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


class LoggingManager:
    """Performs logging settings in the application."""

    def __init__(self, *, debug: bool, log_dir: Path, project_name: str) -> None:
        """
        Initializes the logging manager.

        :param debug: Enables debug-level logging if True.
        :param log_dir: Path to the directory where logs will be stored.
        :param project_name: Name of the project, used as the log file name.
        """
        logger.remove()
        logger.configure(patcher=_patch_record)
        log_level: int = logging.DEBUG if debug else logging.INFO
        # The console
        logger.add(
            sink=stderr,
            level=log_level,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | "
            f"<cyan>{_LOCATION_FORMAT}</cyan> | <level>{{message}}</level>",
            colorize=True,
        )
        # The file
        log_dir.mkdir(parents=True, exist_ok=True)
        logger.add(
            sink=log_dir / f"{project_name.replace(' ', '_').lower()}.log",
            level=log_level,
            format=f"{{time:YYYY-MM-DD HH:mm:ss}} | {{level: <8}} | {_LOCATION_FORMAT} | {{message}}",
            encoding="utf-8",
            enqueue=True,  # Makes logging asynchronous
        )
        self._setup_intercept_handler(log_level=log_level)

    @staticmethod
    def _setup_intercept_handler(log_level: int) -> None:
        """
        Sets up the InterceptHandler to redirect standard logging (root logger) to Loguru.

        :param log_level: The logging level to set for the standard logger.
        :return: None
        """
        standard_logger: logging.Logger = logging.getLogger()
        standard_logger.handlers = [InterceptHandler()]
        standard_logger.setLevel(level=log_level)
