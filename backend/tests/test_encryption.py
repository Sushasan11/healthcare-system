"""PHI encryption verification tests.

Asserts that sensitive patient fields are stored encrypted in the database
(AES-256-GCM, NOT plaintext), and that they decrypt correctly when read
back through the ORM.
"""

import base64

import pytest
from sqlalchemy import text

from app.models.patient_profile import PatientProfile
from app.models.user import AccountStatus, User, UserRole


async def _create_test_user(db_session) -> User:
    """Create a minimal user row to satisfy the patient_profiles FK."""
    from app.core.security import hash_password

    user = User(
        email="phi-test@example.com",
        hashed_password=hash_password("Test@1234"),
        full_name="PHI Test Patient",
        role=UserRole.patient,
        account_status=AccountStatus.active,
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_phi_encrypted_at_rest(db_session):
    """PHI columns must be stored encrypted in the database, not plaintext."""
    plaintext_phone = "+1-555-867-5309"
    plaintext_address = "123 Main St, Springfield, USA"
    plaintext_allergies = "Penicillin, Sulfa drugs"

    user = await _create_test_user(db_session)

    profile = PatientProfile(
        user_id=user.id,
        phone=plaintext_phone,
        address=plaintext_address,
        allergies=plaintext_allergies,
    )
    db_session.add(profile)
    await db_session.flush()

    # Read the raw column values directly from the database (bypasses the ORM TypeDecorator)
    result = await db_session.execute(
        text(
            "SELECT phone, address, allergies FROM patient_profiles WHERE id = :id"
        ),
        {"id": profile.id},
    )
    row = result.fetchone()

    raw_phone, raw_address, raw_allergies = row

    # --- Assertion 1: raw values are NOT the original plaintext ---
    assert raw_phone != plaintext_phone, (
        "phone stored as plaintext — PHI encryption is NOT working"
    )
    assert raw_address != plaintext_address, (
        "address stored as plaintext — PHI encryption is NOT working"
    )
    assert raw_allergies != plaintext_allergies, (
        "allergies stored as plaintext — PHI encryption is NOT working"
    )

    # --- Assertion 2: raw values are valid base64 (nonce + AES-GCM ciphertext) ---
    for raw_val, field_name in [
        (raw_phone, "phone"),
        (raw_address, "address"),
        (raw_allergies, "allergies"),
    ]:
        try:
            decoded = base64.b64decode(raw_val)
        except Exception:
            pytest.fail(
                f"{field_name}: stored value is not valid base64 — expected AES-256-GCM ciphertext"
            )
        # AES-256-GCM ciphertext must be at least nonce (12 bytes) + 1 byte ciphertext
        assert len(decoded) > 12, (
            f"{field_name}: base64-decoded value is too short to be AES-256-GCM output"
        )

    # --- Assertion 3: ORM read decrypts back to original plaintext ---
    await db_session.refresh(profile)
    assert profile.phone == plaintext_phone, (
        f"phone decrypted to '{profile.phone}', expected '{plaintext_phone}'"
    )
    assert profile.address == plaintext_address, (
        f"address decrypted to '{profile.address}', expected '{plaintext_address}'"
    )
    assert profile.allergies == plaintext_allergies, (
        f"allergies decrypted to '{profile.allergies}', expected '{plaintext_allergies}'"
    )


async def test_phi_none_stored_as_null(db_session):
    """NULL PHI fields must remain NULL in the database, not encrypted empty strings."""
    from app.core.security import hash_password

    user = User(
        email="phi-null-test@example.com",
        hashed_password=hash_password("Test@1234"),
        full_name="PHI Null Test",
        role=UserRole.patient,
        account_status=AccountStatus.active,
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = PatientProfile(user_id=user.id, phone=None, address=None)
    db_session.add(profile)
    await db_session.flush()

    result = await db_session.execute(
        text("SELECT phone, address FROM patient_profiles WHERE id = :id"),
        {"id": profile.id},
    )
    row = result.fetchone()
    assert row.phone is None, "NULL phone should remain NULL in DB, not be encrypted"
    assert row.address is None, "NULL address should remain NULL in DB, not be encrypted"
