"""add gid to student_groups

Revision ID: 004
Revises: 003
Create Date: 2026-04-24 08:55:51.782508

Renamed from 87da41021ee1_add_gid_to_student_groups.py to follow the
sequential numeric naming convention used by all other migrations.

EXISTING DATABASES: if this migration was already applied under the old
revision ID (87da41021ee1), run this one-time SQL before upgrading:
    UPDATE alembic_version SET version_num = '004' WHERE version_num = '87da41021ee1';
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("student_groups", sa.Column("google_sheet_gid", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("student_groups", "google_sheet_gid")
