"""Add invite_tokens table

Revision ID: 002
Revises: 001
Create Date: 2026-04-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'invite_tokens' not in inspector.get_table_names():
        op.create_table(
            'invite_tokens',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('token', sa.String(), nullable=False, unique=True, index=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
            sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('invite_tokens')
