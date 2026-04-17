"""Phase 8: drug inventory columns (category, description, dosage, stock, thresholds, flags)."""
from alembic import op
import sqlalchemy as sa

revision = "009_drug_inventory"
down_revision = "008_pharmacy_orders_v2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "drugs",
        sa.Column("category", sa.String(50), nullable=False, server_default="first_aid"),
    )
    op.add_column("drugs", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("drugs", sa.Column("dosage", sa.String(100), nullable=True))
    op.add_column(
        "drugs",
        sa.Column("stock_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "drugs",
        sa.Column(
            "low_stock_threshold", sa.Integer(), nullable=False, server_default="10"
        ),
    )
    op.add_column(
        "drugs",
        sa.Column("rx_required", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "drugs",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Backfill is implicit via server_default on existing rows.


def downgrade():
    op.drop_column("drugs", "archived")
    op.drop_column("drugs", "rx_required")
    op.drop_column("drugs", "low_stock_threshold")
    op.drop_column("drugs", "stock_count")
    op.drop_column("drugs", "dosage")
    op.drop_column("drugs", "description")
    op.drop_column("drugs", "category")
