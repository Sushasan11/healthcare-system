"""Tests for real-time consultation: chat, WebRTC signaling, file upload.

Covers: CONS-01 (chat + persistence + read receipts + file upload),
        CONS-02 (audio escalation signaling),
        CONS-03 (video escalation signaling).
"""
import pytest


# --- CONS-01: Chat message delivery ---
@pytest.mark.asyncio
async def test_chat_message_delivery(async_client, test_consultation):
    """WebSocket chat message sent by patient is received by doctor."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_message_persistence(async_client, test_consultation, db_session):
    """Messages are persisted to DB with EncryptedString content."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_redis_pubsub_relay(async_client, test_consultation):
    """Multi-worker: messages publish to Redis and relay to other worker connections."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_read_receipts(async_client, test_consultation, db_session):
    """Read receipts update delivered_at and read_at timestamps on Message rows."""
    pytest.skip("Stub — implementation in Plan 02")


# --- CONS-01: File upload ---
@pytest.mark.asyncio
async def test_file_upload_blocking(async_client, test_consultation):
    """File upload blocked for executable extensions (.exe, .sh, .bat, .ps1, .py, .js, .dll, .msi)."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_file_upload_size_limit(async_client, test_consultation):
    """File upload rejected when over 25MB."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_file_upload_allowed_types(async_client, test_consultation):
    """File upload succeeds for allowed types (jpg, png, pdf, docx)."""
    pytest.skip("Stub — implementation in Plan 02")


# --- CONS-02: Audio escalation ---
@pytest.mark.asyncio
async def test_call_initiation_doctor_only(async_client, test_consultation):
    """Only the doctor can initiate a call; patient call_initiated is rejected."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_webrtc_signaling_relay(async_client, test_consultation):
    """Signaling messages (offer, answer, ICE) are relayed through WebSocket to the other party."""
    pytest.skip("Stub — implementation in Plan 02")


# --- CONS-03: Video escalation ---
@pytest.mark.asyncio
async def test_video_escalation_signal(async_client, test_consultation):
    """Video escalation triggers call_initiated with media='video' to patient."""
    pytest.skip("Stub — implementation in Plan 02")


# --- REST endpoints ---
@pytest.mark.asyncio
async def test_create_consultation(async_client, test_consultation):
    """POST /consultations creates a consultation linked to a confirmed appointment."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_end_consultation_doctor_only(async_client, test_consultation):
    """Only the doctor can end a consultation; patient attempt returns 403."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_list_consultations(async_client, test_consultation):
    """GET /consultations returns consultations filtered by role."""
    pytest.skip("Stub — implementation in Plan 02")


@pytest.mark.asyncio
async def test_get_consultation_messages(async_client, test_consultation):
    """GET /consultations/{id}/messages returns message history."""
    pytest.skip("Stub — implementation in Plan 02")
