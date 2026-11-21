"""Tests for src/app/main.py: the entry point builds the application from the global settings."""

# ruff: noqa: S101

import sys
from importlib import import_module

import pytest
from fastapi import FastAPI

import app.app_factory as app_factory  # noqa: PLR0402 - for basedpyright 'from app import' means the tests' own app package

__all__: tuple[str, ...] = ()


def test_entry_point_builds_the_application(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Importing app.main creates the application (the global logging setup is skipped).

    :param monkeypatch: pytest's monkeypatch fixture.
    :return: None
    """
    monkeypatch.setattr(target=app_factory, name="LoggingManager", value=lambda **_: None)
    monkeypatch.delitem(sys.modules, "app.main", raising=False)
    application: object = import_module(name="app.main").app
    assert isinstance(application, FastAPI)
    assert application.title == "Test Project"
