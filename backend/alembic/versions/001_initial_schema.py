"""Initial schema — users and patient_profiles tables.

Revision ID: 001
Revises:
Create Date: 2026-03-20 00:00:00.000000

PHI columns (phone, address, emergency_contact, allergies, current_medications,
chronic_conditions) use String storage because AES-256-GCM encryption happens
at the application layer via the EncryptedString TypeDecorator. The DB column
stores base64(nonce + ciphertext), not plaintext.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create UserRole enum
    userrole = sa.Enum(
        "patient", "doctor", "pharmacist", "admin",
        name="userrole",
    )
    # Create AccountStatus enum
    accountstatus = sa.Enum(
        "pending_verification", "pending_approval", "active", "suspended",
        name="accountstatus",
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", userrole, nullable=False),
        sa.Column(
            "account_status",
            accountstatus,
            nullable=False,
            server_default="pending_verification",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        # Doctor-specific fields (NULL for non-doctors)
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("medical_license_number", sa.String(100), nullable=True),
        sa.Column("years_of_experience", sa.Integer(), nullable=True),
        # Shared optional fields
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "patient_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        # Unencrypted — queryable fields
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("blood_type", sa.String(10), nullable=True),
        # Encrypted PHI fields — stored as base64(nonce + AES-256-GCM ciphertext)
        sa.Column("phone", sa.String(500), nullable=True),
        sa.Column("address", sa.String(1000), nullable=True),
        sa.Column("emergency_contact", sa.String(500), nullable=True),
        sa.Column("allergies", sa.String(2000), nullable=True),
        sa.Column("current_medications", sa.String(2000), nullable=True),
        sa.Column("chronic_conditions", sa.String(2000), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("patient_profiles")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS accountstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
