"""Application entry point."""

from fastapi import FastAPI

from app.app_factory import AppFactory

__all__: tuple[str, ...] = ("app",)

app: FastAPI = AppFactory().app
