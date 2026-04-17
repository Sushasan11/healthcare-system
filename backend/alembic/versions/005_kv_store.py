"""Add kv_store table (replaces Redis for key-value storage with TTL)

Revision ID: 005
Revises: 004
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "kv_store",
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("value", sa.Text, nullable=False, server_default=""),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("kv_store")
