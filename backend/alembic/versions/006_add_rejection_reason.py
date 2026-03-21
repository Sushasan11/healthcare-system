"""Add rejection_reason column to users table

Revision ID: 006
Revises: 005
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("rejection_reason", sa.String(1000), nullable=True))


def downgrade():
    op.drop_column("users", "rejection_reason")
