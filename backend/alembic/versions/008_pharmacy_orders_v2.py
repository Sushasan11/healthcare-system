"""Phase 7: pharmacy orders v2 — new status enum, prescription FK, drug price, timestamps."""
from alembic import op
import sqlalchemy as sa

revision = "008_pharmacy_orders_v2"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pharmacy_orders",
        sa.Column("pharmacist_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column(
            "prescription_id",
            sa.Integer(),
            sa.ForeignKey("prescriptions.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column("rejection_reason", sa.String(1000), nullable=True),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pharmacy_orders",
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_pharmacy_orders_prescription_id",
        "pharmacy_orders",
        ["prescription_id"],
    )
    op.add_column(
        "prescription_items",
        sa.Column("drug_id", sa.Integer(), sa.ForeignKey("drugs.id"), nullable=True),
    )
    op.add_column(
        "prescription_items",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "drugs",
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
    )


def downgrade():
    op.drop_column("drugs", "price")
    op.drop_column("prescription_items", "quantity")
    op.drop_column("prescription_items", "drug_id")
    op.drop_constraint(
        "uq_pharmacy_orders_prescription_id",
        "pharmacy_orders",
        type_="unique",
    )
    op.drop_column("pharmacy_orders", "rejected_at")
    op.drop_column("pharmacy_orders", "delivered_at")
    op.drop_column("pharmacy_orders", "dispatched_at")
    op.drop_column("pharmacy_orders", "verified_at")
    op.drop_column("pharmacy_orders", "rejection_reason")
    op.drop_column("pharmacy_orders", "prescription_id")
    op.drop_column("pharmacy_orders", "pharmacist_id")
