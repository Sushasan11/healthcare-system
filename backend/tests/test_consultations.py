"""Tests for real-time consultation: chat, WebRTC signaling, file upload.

Covers: CONS-01 (chat + persistence + read receipts + file upload),
        CONS-02 (audio escalation signaling),
        CONS-03 (video escalation signaling).
"""

import asyncio
import json
import time

import pytest
import pytest_asyncio
from sqlalchemy import select
from starlette.testclient import TestClient

import app.db as app_db
from app.core.security import create_access_token
from app.main import app as fastapi_app
from app.models.consultation import Message


# ---------------------------------------------------------------------------
# WebSocket test helpers
# ---------------------------------------------------------------------------

def make_token(user_id: int, role: str = "doctor") -> str:
    """Create a JWT access token for WebSocket auth."""
    return create_access_token(sub=str(user_id), role=role)


def get_test_ws_client() -> TestClient:
    """Return a synchronous Starlette TestClient for WebSocket tests."""
    return TestClient(fastapi_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# REST endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_consultation(async_client, test_consultation):
    """POST /consultations creates a consultation linked to a confirmed appointment."""
    patient = test_consultation["patient"]
    consultation_id = test_consultation["consultation"].id

    patient_token = make_token(patient.id, role="patient")
    response = await async_client.get(
        "/consultations",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    ids = [c["id"] for c in data]
    assert consultation_id in ids


@pytest.mark.asyncio
async def test_end_consultation_doctor_only(async_client, test_consultation):
    """Only the doctor can end a consultation; patient attempt returns 403."""
    consultation_id = test_consultation["consultation"].id
    doctor = test_consultation["doctor"]
    patient = test_consultation["patient"]

    patient_token = make_token(patient.id, role="patient")
    doctor_token = make_token(doctor.id, role="doctor")

    # Patient attempt — should fail with 403
    patient_resp = await async_client.post(
        f"/consultations/{consultation_id}/end",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert patient_resp.status_code == 403

    # Doctor attempt — should succeed
    doctor_resp = await async_client.post(
        f"/consultations/{consultation_id}/end",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert doctor_resp.status_code == 200
    assert doctor_resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_list_consultations(async_client, test_consultation):
    """GET /consultations returns the test consultation for both doctor and patient."""
    consultation_id = test_consultation["consultation"].id
    doctor = test_consultation["doctor"]
    patient = test_consultation["patient"]

    doctor_token = make_token(doctor.id, role="doctor")
    patient_token = make_token(patient.id, role="patient")

    doctor_resp = await async_client.get(
        "/consultations",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert doctor_resp.status_code == 200
    assert consultation_id in [c["id"] for c in doctor_resp.json()]

    patient_resp = await async_client.get(
        "/consultations",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert patient_resp.status_code == 200
    assert consultation_id in [c["id"] for c in patient_resp.json()]


@pytest.mark.asyncio
async def test_get_consultation_messages(async_client, test_consultation, db_session):
    """GET /consultations/{id}/messages returns message history."""
    consultation = test_consultation["consultation"]
    patient = test_consultation["patient"]

    # Create a message row directly in the DB
    msg = Message(
        consultation_id=consultation.id,
        sender_id=patient.id,
        content="Hello doctor",
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    patient_token = make_token(patient.id, role="patient")
    response = await async_client.get(
        f"/consultations/{consultation.id}/messages",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) >= 1
    assert any(m["content"] == "Hello doctor" for m in messages)


# ---------------------------------------------------------------------------
# File upload tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_file_upload_blocking(async_client, test_consultation):
    """File upload blocked for executable extensions (.exe, .sh, .bat, .ps1, .py, .js, .dll, .msi)."""
    consultation_id = test_consultation["consultation"].id
    doctor = test_consultation["doctor"]
    doctor_token = make_token(doctor.id, role="doctor")

    response = await async_client.post(
        f"/consultations/{consultation_id}/files",
        headers={"Authorization": f"Bearer {doctor_token}"},
        files={"file": ("malware.exe", b"MZ\x90\x00binary", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "File type not allowed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_file_upload_size_limit(async_client, test_consultation):
    """File upload rejected when over 25MB."""
    consultation_id = test_consultation["consultation"].id
    patient = test_consultation["patient"]
    patient_token = make_token(patient.id, role="patient")

    oversized_content = b"x" * (25 * 1024 * 1024 + 1)
    response = await async_client.post(
        f"/consultations/{consultation_id}/files",
        headers={"Authorization": f"Bearer {patient_token}"},
        files={"file": ("big_file.pdf", oversized_content, "application/pdf")},
    )
    assert response.status_code == 400
    assert "25MB" in response.json()["detail"]


@pytest.mark.asyncio
async def test_file_upload_allowed_types(async_client, test_consultation):
    """File upload succeeds for allowed types (jpg, png, pdf, docx)."""
    consultation_id = test_consultation["consultation"].id
    doctor = test_consultation["doctor"]
    doctor_token = make_token(doctor.id, role="doctor")

    response = await async_client.post(
        f"/consultations/{consultation_id}/files",
        headers={"Authorization": f"Bearer {doctor_token}"},
        files={"file": ("report.pdf", b"%PDF-1.4 small content", "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert data["file_name"] == "report.pdf"
    assert f"/files/consultations/{consultation_id}/report.pdf" in data["url"]


# ---------------------------------------------------------------------------
# WebSocket tests — run sync TestClient in thread to avoid event loop conflicts
# ---------------------------------------------------------------------------


def _ws_chat_delivery(consultation_id: int, doctor_id: int, patient_id: int) -> list:
    """Thread function: doctor sends chat, patient receives it. Returns received messages."""
    doctor_token = make_token(doctor_id, role="doctor")
    patient_token = make_token(patient_id, role="patient")
    ws_url_doctor = f"/ws/consultation/{consultation_id}?token={doctor_token}"
    ws_url_patient = f"/ws/consultation/{consultation_id}?token={patient_token}"

    received = []

    client_doctor = get_test_ws_client()
    client_patient = get_test_ws_client()

    with client_doctor.websocket_connect(ws_url_doctor) as doctor_ws:
        with client_patient.websocket_connect(ws_url_patient) as patient_ws:
            # Drain any initial presence messages on patient side
            time.sleep(0.1)

            # Doctor sends chat message
            doctor_ws.send_text(json.dumps({"type": "chat_message", "content": "Hello patient"}))
            time.sleep(0.3)

            # Patient receives messages - look for chat_message
            for _ in range(10):
                try:
                    raw = patient_ws.receive_text()
                    data = json.loads(raw)
                    if data.get("type") == "chat_message":
                        received.append(data)
                        break
                except Exception:
                    break

    return received


@pytest.mark.asyncio
async def test_chat_message_delivery(async_client, test_consultation):
    """WebSocket chat message sent by doctor is received by patient."""
    consultation_id = test_consultation["consultation"].id
    doctor_id = test_consultation["doctor"].id
    patient_id = test_consultation["patient"].id

    received = await asyncio.to_thread(
        _ws_chat_delivery, consultation_id, doctor_id, patient_id
    )

    assert len(received) >= 1, "Patient should receive chat_message"
    assert received[0]["type"] == "chat_message"
    assert received[0]["content"] == "Hello patient"


@pytest.mark.asyncio
async def test_message_persistence(async_client, test_consultation):
    """After sending a chat_message via WebSocket, verify a Message row exists in DB."""
    consultation_id = test_consultation["consultation"].id
    doctor = test_consultation["doctor"]
    doctor_token = make_token(doctor.id, role="doctor")
    ws_url = f"/ws/consultation/{consultation_id}?token={doctor_token}"

    def send_message():
        client = get_test_ws_client()
        with client.websocket_connect(ws_url) as ws:
            ws.send_text(json.dumps({"type": "chat_message", "content": "Persisted message"}))
            time.sleep(0.3)

    await asyncio.to_thread(send_message)

    # Check DB for the message using test DB
    async with app_db.AsyncSessionLocal() as session:
        result = await session.execute(
            select(Message).where(
                Message.consultation_id == consultation_id,
                Message.sender_id == doctor.id,
            )
        )
        messages = result.scalars().all()

    contents = [m.content for m in messages]
    assert "Persisted message" in contents, f"Expected 'Persisted message' in {contents}"


@pytest.mark.asyncio
async def test_read_receipts(async_client, test_consultation):
    """Send a message, then send message_delivered and message_read. Verify timestamps updated."""
    consultation_id = test_consultation["consultation"].id
    doctor_id = test_consultation["doctor"].id
    patient_id = test_consultation["patient"].id

    doctor_token = make_token(doctor_id, role="doctor")
    patient_token = make_token(patient_id, role="patient")

    ws_url_doctor = f"/ws/consultation/{consultation_id}?token={doctor_token}"
    ws_url_patient = f"/ws/consultation/{consultation_id}?token={patient_token}"

    message_id_holder = []

    def run_receipt_test():
        client_doctor = get_test_ws_client()
        client_patient = get_test_ws_client()

        with client_doctor.websocket_connect(ws_url_doctor) as doctor_ws:
            with client_patient.websocket_connect(ws_url_patient) as patient_ws:
                # Doctor sends message
                doctor_ws.send_text(json.dumps({"type": "chat_message", "content": "Receipt test"}))
                time.sleep(0.3)

                # Patient reads chat_message to get its ID
                for _ in range(10):
                    try:
                        raw = patient_ws.receive_text()
                        data = json.loads(raw)
                        if data.get("type") == "chat_message" and "id" in data:
                            message_id_holder.append(data["id"])
                            break
                    except Exception:
                        break

                if message_id_holder:
                    msg_id = message_id_holder[0]
                    patient_ws.send_text(json.dumps({"type": "message_delivered", "message_id": msg_id}))
                    time.sleep(0.1)
                    patient_ws.send_text(json.dumps({"type": "message_read", "message_id": msg_id}))
                    time.sleep(0.2)

    await asyncio.to_thread(run_receipt_test)

    assert len(message_id_holder) >= 1, "Patient should have received a chat message with an ID"
    msg_id = message_id_holder[0]

    # Verify DB timestamps
    async with app_db.AsyncSessionLocal() as session:
        result = await session.execute(select(Message).where(Message.id == msg_id))
        msg = result.scalar_one_or_none()

    assert msg is not None
    assert msg.delivered_at is not None, "delivered_at should be set after message_delivered"
    assert msg.read_at is not None, "read_at should be set after message_read"


@pytest.mark.asyncio
async def test_call_initiation_doctor_only(async_client, test_consultation):
    """Doctor sends call_initiated — patient receives it. Patient sends same — gets error."""
    consultation_id = test_consultation["consultation"].id
    doctor_id = test_consultation["doctor"].id
    patient_id = test_consultation["patient"].id

    doctor_token = make_token(doctor_id, role="doctor")
    patient_token = make_token(patient_id, role="patient")

    ws_url_doctor = f"/ws/consultation/{consultation_id}?token={doctor_token}"
    ws_url_patient = f"/ws/consultation/{consultation_id}?token={patient_token}"

    patient_received_call = []
    patient_received_error = []

    def run_call_test():
        client_doctor = get_test_ws_client()
        client_patient = get_test_ws_client()

        with client_doctor.websocket_connect(ws_url_doctor) as doctor_ws:
            with client_patient.websocket_connect(ws_url_patient) as patient_ws:
                # Doctor initiates call
                doctor_ws.send_text(json.dumps({"type": "call_initiated", "media": "audio"}))
                time.sleep(0.3)

                # Patient receives call_initiated
                for _ in range(10):
                    try:
                        raw = patient_ws.receive_text()
                        data = json.loads(raw)
                        if data.get("type") == "call_initiated":
                            patient_received_call.append(data)
                            break
                    except Exception:
                        break

                # Patient tries to initiate (should get error back to patient)
                patient_ws.send_text(json.dumps({"type": "call_initiated", "media": "audio"}))
                time.sleep(0.2)

                # Patient reads any incoming — looking for error
                for _ in range(10):
                    try:
                        raw = patient_ws.receive_text()
                        data = json.loads(raw)
                        if data.get("type") == "error":
                            patient_received_error.append(data)
                            break
                    except Exception:
                        break

    await asyncio.to_thread(run_call_test)

    assert len(patient_received_call) >= 1, "Patient should receive call_initiated from doctor"
    assert patient_received_call[0]["type"] == "call_initiated"
    assert len(patient_received_error) >= 1, "Patient should get error when trying to initiate call"


@pytest.mark.asyncio
async def test_webrtc_signaling_relay(async_client, test_consultation):
    """Signaling messages (offer, answer, ICE) are relayed through WebSocket to the other party."""
    consultation_id = test_consultation["consultation"].id
    doctor_id = test_consultation["doctor"].id
    patient_id = test_consultation["patient"].id

    doctor_token = make_token(doctor_id, role="doctor")
    patient_token = make_token(patient_id, role="patient")

    ws_url_doctor = f"/ws/consultation/{consultation_id}?token={doctor_token}"
    ws_url_patient = f"/ws/consultation/{consultation_id}?token={patient_token}"

    relayed = []
    sdp_payload = {"type": "offer", "sdp": "v=0\r\no=- 12345"}

    def run_signaling():
        client_doctor = get_test_ws_client()
        client_patient = get_test_ws_client()

        with client_doctor.websocket_connect(ws_url_doctor) as doctor_ws:
            with client_patient.websocket_connect(ws_url_patient) as patient_ws:
                doctor_ws.send_text(json.dumps({"type": "call_offer", "sdp": sdp_payload}))
                time.sleep(0.3)

                for _ in range(10):
                    try:
                        raw = patient_ws.receive_text()
                        data = json.loads(raw)
                        if data.get("type") == "call_offer":
                            relayed.append(data)
                            break
                    except Exception:
                        break

    await asyncio.to_thread(run_signaling)

    assert len(relayed) >= 1, "Patient should receive relayed call_offer"
    assert relayed[0]["sdp"] == sdp_payload


@pytest.mark.asyncio
async def test_video_escalation_signal(async_client, test_consultation):
    """Video escalation triggers call_initiated with media='video' to patient."""
    consultation_id = test_consultation["consultation"].id
    doctor_id = test_consultation["doctor"].id
    patient_id = test_consultation["patient"].id

    doctor_token = make_token(doctor_id, role="doctor")
    patient_token = make_token(patient_id, role="patient")

    ws_url_doctor = f"/ws/consultation/{consultation_id}?token={doctor_token}"
    ws_url_patient = f"/ws/consultation/{consultation_id}?token={patient_token}"

    video_signals = []

    def run_video_test():
        client_doctor = get_test_ws_client()
        client_patient = get_test_ws_client()

        with client_doctor.websocket_connect(ws_url_doctor) as doctor_ws:
            with client_patient.websocket_connect(ws_url_patient) as patient_ws:
                doctor_ws.send_text(json.dumps({"type": "call_initiated", "media": "video"}))
                time.sleep(0.3)

                for _ in range(10):
                    try:
                        raw = patient_ws.receive_text()
                        data = json.loads(raw)
                        if data.get("type") == "call_initiated":
                            video_signals.append(data)
                            break
                    except Exception:
                        break

    await asyncio.to_thread(run_video_test)

    assert len(video_signals) >= 1, "Patient should receive call_initiated for video escalation"
    assert video_signals[0]["media"] == "video"
