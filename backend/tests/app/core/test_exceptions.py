"""Tests for src/app/core/exceptions.py."""

import pytest

from app.core.exceptions import AppError

__all__: tuple[str, ...] = ()


def test_app_error_is_an_exception() -> None:
    """
    AppError is the base of the application exceptions and is caught as an Exception.

    :return: None
    """
    with pytest.raises(Exception, match="broken"):
        raise AppError("broken")
