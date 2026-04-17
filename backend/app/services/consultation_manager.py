"""ConsultationManager — manages WebSocket connections for consultation rooms.

Uses direct local relay for message broadcasting.
"""

import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConsultationManager:
    """Manages WebSocket connections for consultation rooms."""

    def __init__(self):
        # {consultation_id: {user_id: WebSocket}}
        self._local: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, consultation_id: int, user_id: int, ws: WebSocket):
        self._local.setdefault(consultation_id, {})[user_id] = ws

    async def disconnect(self, consultation_id: int, user_id: int):
        room = self._local.get(consultation_id, {})
        room.pop(user_id, None)
        if not room:
            self._local.pop(consultation_id, None)

    async def publish(self, consultation_id: int, message: dict):
        data = json.dumps(message)
        await self._relay_local(consultation_id, data)

    async def _relay_local(self, consultation_id: int, data: str):
        room = self._local.get(consultation_id, {})
        dead = []
        for uid, ws in list(room.items()):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            room.pop(uid, None)


manager = ConsultationManager()
