"""019 – student profession field

Adds:
  students.profession   VARCHAR NULL   (المهنة — collected on course registration)

Revision ID: 019
Revises: 018
"""
from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("students", sa.Column("profession", sa.String(), nullable=True))


def downgrade():
    op.drop_column("students", "profession")
