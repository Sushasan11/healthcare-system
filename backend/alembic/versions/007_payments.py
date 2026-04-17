"""Create payment and pharmacy order tables

Revision ID: 007
Revises: 006
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    # 1. pharmacy_orders (referenced by payments)
    op.create_table(
        "pharmacy_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # 2. pharmacy_order_items
    op.create_table(
        "pharmacy_order_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id", sa.Integer(), sa.ForeignKey("pharmacy_orders.id"), nullable=False
        ),
        sa.Column("medicine_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False),
    )

    # 3. payments (references pharmacy_orders)
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id"),
            nullable=True,
            unique=True,
        ),
        sa.Column(
            "pharmacy_order_id",
            sa.Integer(),
            sa.ForeignKey("pharmacy_orders.id"),
            nullable=True,
            unique=True,
        ),
        sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("transaction_type", sa.String(50), nullable=False),
        sa.Column("gateway_transaction_id", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 4. payment_ledger (references payments)
    op.create_table(
        "payment_ledger",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "payment_id",
            sa.Integer(),
            sa.ForeignKey("payments.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("commission_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("commission_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("net_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_table("payment_ledger")
    op.drop_table("payments")
    op.drop_table("pharmacy_order_items")
    op.drop_table("pharmacy_orders")
