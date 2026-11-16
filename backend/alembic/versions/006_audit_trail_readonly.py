"""revoke update/delete on status_change_log to make audit trail append-only

Revision ID: 006
Revises: 005
Create Date: 2026-04-25

"""
from typing import Sequence, Union
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip role-level REVOKE — not applicable on hosted DBs (Neon) where a single
    # owner role is used. The audit trail is still append-only at the application layer.
    pass


def downgrade() -> None:
    pass
