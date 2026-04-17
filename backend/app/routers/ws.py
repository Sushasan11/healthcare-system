"""WebSocket router for real-time consultation sessions.

Endpoint: /ws/consultation/{consultation_id}?token=<JWT>

Authentication is performed via JWT query parameter BEFORE accept().
Message dispatch handles 14 typed message types:
  chat_message, message_delivered, message_read, typing_start, typing_stop,
  presence, call_offer, call_answer, ice_candidate, call_initiated,
  call_accepted, call_declined, call_ended, consultation_ended, error
"""

import json
import logging
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db import AsyncSessionLocal
from app.models.appointment import Appointment
from app.models.consultation import Consultation, Message
from app.services.consultation_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# WebSocket close codes
WS_1008_POLICY_VIOLATION = 1008
WS_1011_INTERNAL_ERROR = 1011


@router.websocket("/ws/consultation/{consultation_id}")
async def consultation_ws(
    consultation_id: int,
    ws: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time consultation communication."""
    # --- JWT auth BEFORE accept() ---
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            await ws.close(code=WS_1008_POLICY_VIOLATION)
            return
        sub = payload.get("sub")
        if sub is None:
            await ws.close(code=WS_1008_POLICY_VIOLATION)
            return
        user_id = int(sub)
        user_role = payload.get("role", "")
    except (jwt.InvalidTokenError, ValueError):
        await ws.close(code=WS_1008_POLICY_VIOLATION)
        return

    # --- Verify participation in consultation ---
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Consultation)
            .options(selectinload(Consultation.appointment))
            .where(Consultation.id == consultation_id)
        )
        consultation = result.scalar_one_or_none()

        if not consultation:
            await ws.close(code=WS_1008_POLICY_VIOLATION)
            return

        appointment = consultation.appointment
        if user_id not in (appointment.patient_id, appointment.doctor_id):
            await ws.close(code=WS_1008_POLICY_VIOLATION)
            return

    # --- Accept connection ---
    await ws.accept()

    # --- Register with manager and broadcast presence ---
    await manager.connect(consultation_id, user_id, ws)
    await manager.publish(
        consultation_id,
        {"type": "presence", "user_id": user_id, "status": "online"},
    )

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(
                    json.dumps({"type": "error", "detail": "Invalid JSON"})
                )
                continue

            msg_type = msg.get("type")

            # --- Message dispatch ---
            if msg_type == "chat_message":
                await _handle_chat_message(
                    msg, consultation_id, user_id
                )

            elif msg_type == "message_delivered":
                await _handle_receipt(
                    msg, "delivered_at", consultation_id, user_id
                )

            elif msg_type == "message_read":
                await _handle_receipt(
                    msg, "read_at", consultation_id, user_id
                )

            elif msg_type in ("typing_start", "typing_stop"):
                # Relay without DB persistence
                await manager.publish(
                    consultation_id,
                    {"type": msg_type, "user_id": user_id},
                )

            elif msg_type == "call_initiated":
                # Only doctor can initiate a call
                if user_role != "doctor":
                    await ws.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "detail": "Only doctors can initiate calls",
                            }
                        )
                    )
                else:
                    await manager.publish(
                        consultation_id,
                        {
                            "type": "call_initiated",
                            "media": msg.get("media", "audio"),
                            "initiator_id": user_id,
                        },
                    )

            elif msg_type in (
                "call_offer",
                "call_answer",
                "ice_candidate",
                "call_accepted",
                "call_declined",
                "call_ended",
            ):
                # WebRTC signaling and call control — relay without modification
                relay_msg = dict(msg)
                relay_msg["sender_id"] = user_id
                await manager.publish(consultation_id, relay_msg)

            elif msg_type == "consultation_ended":
                await manager.publish(
                    consultation_id,
                    {"type": "consultation_ended", "user_id": user_id},
                )

            else:
                await ws.send_text(
                    json.dumps({"type": "error", "detail": f"Unknown message type: {msg_type}"})
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception(f"WebSocket error in consultation {consultation_id}: {e}")
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.close(code=WS_1011_INTERNAL_ERROR)
    finally:
        await manager.disconnect(consultation_id, user_id)
        try:
            await manager.publish(
                consultation_id,
                {"type": "presence", "user_id": user_id, "status": "offline"},
            )
        except Exception:
            pass


async def _handle_chat_message(
    msg: dict,
    consultation_id: int,
    sender_id: int,
):
    """Persist chat message to DB (content encrypted via EncryptedString) and publish."""
    async with AsyncSessionLocal() as session:
        message = Message(
            consultation_id=consultation_id,
            sender_id=sender_id,
            content=msg.get("content"),
        )
        session.add(message)
        await session.commit()
        await session.refresh(message)

        timestamp = (
            message.created_at.isoformat()
            if isinstance(message.created_at, datetime)
            else str(message.created_at)
        )

    await manager.publish(
        consultation_id,
        {
            "type": "chat_message",
            "id": message.id,
            "sender_id": sender_id,
            "content": msg.get("content"),
            "timestamp": timestamp,
        },
    )


async def _handle_receipt(
    msg: dict,
    field: str,
    consultation_id: int,
    user_id: int,
):
    """Update delivered_at or read_at on a Message row and relay confirmation."""
    message_id = msg.get("message_id")
    if not message_id:
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Message)
            .where(Message.id == message_id)
            .values(**{field: now})
        )
        await session.commit()

    receipt_type = "message_delivered" if field == "delivered_at" else "message_read"
    await manager.publish(
        consultation_id,
        {
            "type": receipt_type,
            "message_id": message_id,
            "user_id": user_id,
        },
    )
