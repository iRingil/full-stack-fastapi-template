"""
Tests for src/app/core/log_setup.py: the one-line log format, InterceptHandler and describe_exception.

LoggingManager reconfigures loguru and the root logger of the process, so every test restores both afterwards.
The log files go to a temporary directory.
"""

# ruff: noqa: PLR2004, S101, S106

import logging
import re
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING

import jwt
import pytest
from fastapi import HTTPException
from loguru import logger
from sqlalchemy import column, table
from sqlalchemy.exc import DBAPIError, StatementError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import _decode_user_id_from_token
from app.core.config import Settings
from app.core.log_setup import InterceptHandler, LoggingManager, _patch_record, describe_exception
from app.core.security import SecurityManager

if TYPE_CHECKING:
    from loguru import Message, Record

__all__: tuple[str, ...] = ()

_CUSTOM_LEVEL: int = 25


@pytest.fixture(autouse=True)
def restore_logging() -> Iterator[None]:
    """
    Restores the root logger, the default loguru handler and an empty loguru patcher after the test.

    :return: None
    """
    root: logging.Logger = logging.getLogger()
    handlers: list[logging.Handler] = root.handlers[:]
    level: int = root.level
    yield
    logger.remove()
    logger.configure(patcher=lambda _: None)
    logger.add(sink=sys.stderr)
    root.handlers = handlers
    root.setLevel(level=level)


def _log_lines(log_dir: Path) -> list[str]:
    """
    Waits for the queued messages and reads the log file of the test project.

    :param log_dir: The log directory.
    :return: The lines of the file.
    """
    logger.complete()
    return (log_dir / "my_project.log").read_text(encoding="utf-8").splitlines()


def _line_with(lines: list[str], text_part: str) -> str:
    """
    The only log line that contains the text.

    :param lines: The log lines.
    :param text_part: The text to look for.
    :return: The line.
    """
    found: list[str] = [line for line in lines if text_part in line]
    assert len(found) == 1, lines
    return found[0]


class Worker:
    """Code that logs, for the location checks: a class with methods."""

    def log_with_loguru(self) -> None:
        """
        Logs a message with loguru.

        :return: None
        """
        logger.info("from loguru")

    def log_with_logging(self) -> None:
        """
        Logs a message with the standard logging, as a library would.

        :return: None
        """
        logging.getLogger("some.library").warning("from logging")

    def log_a_failure(self) -> None:
        """
        Logs a caught exception with the standard logging, as uvicorn does for a failed request.

        :return: None
        """
        try:
            _ = {}["missing"]
        except KeyError:
            logging.getLogger("uvicorn.error").exception("Exception in ASGI application")


class TestLoggingManager:
    """Tests for LoggingManager and the format of the lines."""

    def test_debug_mode(self, tmp_path: Path) -> None:
        """
        In debug mode the log directory is created, and debug messages of the standard logging reach the file.

        :param tmp_path: A temporary directory.
        :return: None
        """
        log_dir: Path = tmp_path / "nested" / "logs"
        LoggingManager(debug=True, log_dir=log_dir, project_name="My Project")
        root: logging.Logger = logging.getLogger()
        assert [type(handler) for handler in root.handlers] == [InterceptHandler]
        assert root.level == logging.DEBUG
        logging.getLogger("some.library").debug("debug from a library")
        assert "| DEBUG    |" in _line_with(lines=_log_lines(log_dir=log_dir), text_part="debug from a library")

    def test_normal_mode(self, tmp_path: Path) -> None:
        """
        Outside debug mode debug messages are dropped and info messages are kept.

        :param tmp_path: A temporary directory.
        :return: None
        """
        LoggingManager(debug=False, log_dir=tmp_path, project_name="My Project")
        assert logging.getLogger().level == logging.INFO
        logger.debug("hidden")
        logger.info("shown")
        lines: list[str] = _log_lines(log_dir=tmp_path)
        assert any("shown" in line for line in lines)
        assert not any("hidden" in line for line in lines)

    def test_lines_name_the_module_the_class_the_method_and_the_line(self, tmp_path: Path) -> None:
        """
        Loguru and standard logging messages both name the code that logged them, the class included.

        :param tmp_path: A temporary directory.
        :return: None
        """
        LoggingManager(debug=True, log_dir=tmp_path, project_name="My Project")
        Worker().log_with_loguru()
        Worker().log_with_logging()
        lines: list[str] = _log_lines(log_dir=tmp_path)
        module: str = __name__
        assert f"| {module}:Worker.log_with_loguru:" in _line_with(lines=lines, text_part="from loguru")
        assert f"| {module}:Worker.log_with_logging:" in _line_with(lines=lines, text_part="from logging")

    def test_an_exception_is_one_line_without_a_traceback(self, tmp_path: Path) -> None:
        """
        A logged exception (here as uvicorn logs it) adds one line to the message and no traceback.

        :param tmp_path: A temporary directory.
        :return: None
        """
        LoggingManager(debug=True, log_dir=tmp_path, project_name="My Project")
        Worker().log_a_failure()
        lines: list[str] = _log_lines(log_dir=tmp_path)
        line: str = _line_with(lines=lines, text_part="Exception in ASGI application")
        expected: str = rf"Exception in ASGI application: KeyError: 'missing' \({__name__}:Worker\.log_a_failure:\d+\)$"
        assert re.search(pattern=expected, string=line)
        assert not any("Traceback" in line for line in lines)

    def test_custom_level_of_the_standard_logging(self, tmp_path: Path) -> None:
        """
        A standard logging level that loguru does not know is passed on by its number.

        :param tmp_path: A temporary directory.
        :return: None
        """
        LoggingManager(debug=True, log_dir=tmp_path, project_name="My Project")
        logging.getLogger("some.library").log(_CUSTOM_LEVEL, "custom level")
        assert "| Level 25 |" in _line_with(lines=_log_lines(log_dir=tmp_path), text_part="custom level")


class TestPatchRecord:
    """Tests for _patch_record on its own."""

    @staticmethod
    def _capture() -> tuple[list["Record"], int]:
        """
        Adds a loguru sink that keeps the raw records.

        :return: The list of records and the handler ID.
        """
        records: list[Record] = []

        def sink(message: "Message") -> None:
            """
            Keeps the record.

            :param message: The loguru message.
            :return: None
            """
            records.append(message.record)

        return records, logger.add(sink=sink)

    def test_record_outside_its_call_stack_keeps_the_function_name(self) -> None:
        """
        When the logging frame is no longer on the stack, the plain function name is used.

        :return: None
        """
        records, handler_id = self._capture()
        logger.info("captured")
        logger.remove(handler_id)
        _patch_record(record=records[0])
        assert records[0]["extra"]["qualname"] == "test_record_outside_its_call_stack_keeps_the_function_name"

    def test_exception_flag_without_an_exception(self) -> None:
        """
        Asking for an exception outside an except block leaves the message as it is.

        :return: None
        """
        records, handler_id = self._capture()
        logger.opt(exception=True).info("no exception")
        logger.remove(handler_id)
        _patch_record(record=records[0])
        assert records[0]["message"] == "no exception"
        assert records[0]["exception"] is None


class TestDescribeException:
    """Tests for describe_exception."""

    def test_points_at_the_project_code(self, settings: Settings, security_manager: SecurityManager) -> None:
        """
        An error is located at the deepest frame of the project's own code: module, class or function, line.

        :param settings: The test settings.
        :param security_manager: The test security manager.
        :return: None
        """
        with pytest.raises(HTTPException) as exc_info:
            _decode_user_id_from_token(token="garbage", settings=settings, security_manager=security_manager)
        description: str = describe_exception(exc=exc_info.value)
        assert description.startswith("HTTPException: 401: Could not validate credentials (app.api.deps:")
        assert ":_decode_user_id_from_token:" in description

    def test_outside_the_project(self) -> None:
        """
        Without project frames the deepest frame is used, even a library one.

        :return: None
        """
        with pytest.raises(jwt.DecodeError) as exc_info:
            jwt.decode(jwt="garbage", key="key", algorithms=["HS256"])
        assert describe_exception(exc=exc_info.value).startswith("DecodeError: Not enough segments (jwt.")

    def test_never_raised(self) -> None:
        """
        An exception without a traceback or a message gives just its type.

        :return: None
        """
        assert describe_exception(exc=ValueError()) == "ValueError: "

    async def test_database_error_without_sql_and_parameters(self, session: AsyncSession) -> None:
        """
        A real PostgreSQL error is described by the driver message, without the SQL text and the parameters.

        :param session: The test session.
        :return: None
        """
        with pytest.raises(DBAPIError) as exc_info:
            await session.exec(
                statement=select(column("id")).select_from(table("no_such_table")).where(column("id") == 42)
            )
        description: str = describe_exception(exc=exc_info.value)
        assert description.startswith('ProgrammingError: relation "no_such_table" does not exist (')
        assert "SELECT" not in description
        assert "42" not in description

    def test_statement_error_without_a_driver_error(self) -> None:
        """
        A statement error that wraps no exception, or one without a cause, keeps its own or that one's message.

        :return: None
        """
        assert describe_exception(exc=StatementError("plain", "SELECT 1", None, None)).startswith(
            "StatementError: plain"
        )
        wrapped: StatementError = StatementError("outer", "SELECT 1", None, ValueError("inner"))
        assert describe_exception(exc=wrapped) == "StatementError: inner"
