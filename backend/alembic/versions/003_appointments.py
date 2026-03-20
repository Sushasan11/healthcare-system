"""Appointments table.

Revision ID: 003
Revises: 002
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    appointmentstatus = sa.Enum(
        "pending", "confirmed", "cancelled", "completed",
        name="appointmentstatus",
    )

    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("slot_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            appointmentstatus,
            nullable=False,
            server_default="confirmed",
        ),
        sa.Column("reason_for_visit", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Partial unique index: only one non-cancelled appointment per doctor per slot
    op.create_index(
        "uq_appointment_active_slot",
        "appointments",
        ["doctor_id", "slot_datetime"],
        unique=True,
        postgresql_where=sa.text("status != 'cancelled'"),
    )


def downgrade() -> None:
    op.drop_index("uq_appointment_active_slot", table_name="appointments")
    op.drop_table("appointments")
    op.execute("DROP TYPE IF EXISTS appointmentstatus")
