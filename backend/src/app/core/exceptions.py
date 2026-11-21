"""Custom exceptions for the application."""

__all__: tuple[str, ...] = ("AppError",)


class AppError(Exception):
    """Base class for all application exceptions."""
