"""ConsultationManager — manages WebSocket connections for consultation rooms.

Uses Redis pub/sub to broadcast messages across multiple workers.
Falls back to direct local relay when Redis is unavailable (single-worker dev mode).
"""

import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConsultationManager:
    """Manages WebSocket connections for consultation rooms.
    Uses Redis pub/sub to broadcast across multiple workers."""

    def __init__(self):
        # {consultation_id: {user_id: WebSocket}}
        self._local: dict[int, dict[int, WebSocket]] = {}
        self._subscriptions: set[int] = set()  # consultation_ids with active subscribers

    async def connect(
        self,
        consultation_id: int,
        user_id: int,
        ws: WebSocket,
        redis: aioredis.Redis | None,
    ):
        self._local.setdefault(consultation_id, {})[user_id] = ws
        if redis and consultation_id not in self._subscriptions:
            self._subscriptions.add(consultation_id)
            asyncio.create_task(self._subscribe(consultation_id, redis))

    async def disconnect(self, consultation_id: int, user_id: int):
        room = self._local.get(consultation_id, {})
        room.pop(user_id, None)
        if not room:
            self._local.pop(consultation_id, None)
            self._subscriptions.discard(consultation_id)

    async def publish(
        self,
        redis: aioredis.Redis | None,
        consultation_id: int,
        message: dict,
    ):
        data = json.dumps(message)
        if redis:
            await redis.publish(f"consultation:{consultation_id}", data)
        else:
            # Fallback: send directly to local connections (single-worker mode)
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

    async def _subscribe(self, consultation_id: int, redis: aioredis.Redis):
        try:
            async with redis.pubsub() as pubsub:
                await pubsub.subscribe(f"consultation:{consultation_id}")
                async for raw in pubsub.listen():
                    if raw["type"] != "message":
                        continue
                    await self._relay_local(consultation_id, raw["data"])
        except Exception as e:
            logger.warning(f"Redis subscriber error for consultation {consultation_id}: {e}")
        finally:
            self._subscriptions.discard(consultation_id)


manager = ConsultationManager()
