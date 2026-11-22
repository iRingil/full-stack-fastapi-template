# ruff: noqa: N999 - Alembic names the file (date, revision id, message); it is loaded by path, never imported
# SQLModel's AutoString is a TypeDecorator without a type argument, so its columns are Column[Unknown]
# pyright: reportUnknownArgumentType=false
"""
${(message[:1].upper() + message[1:]).rstrip(".")}.

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlmodel.sql.sqltypes import AutoString
${imports if imports else ""}

__all__: tuple[str, ...] = ("depends_on", "down_revision", "downgrade", "revision", "upgrade")

revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    """
    Applies the migration.

    :return: None
    """
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """
    Undoes the migration.

    :return: None
    """
    ${downgrades if downgrades else "pass"}
