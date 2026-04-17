"""Phase 9 D-30: add nullable drug_id FK on pharmacy_order_items."""
from alembic import op
import sqlalchemy as sa

revision = "010_order_item_drug_id"
down_revision = "009_drug_inventory"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pharmacy_order_items",
        sa.Column(
            "drug_id",
            sa.Integer(),
            sa.ForeignKey("drugs.id"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("pharmacy_order_items", "drug_id")
