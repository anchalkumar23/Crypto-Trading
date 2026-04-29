"""WebSocket connection manager — fan-out for tick / trade / price events."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("ws")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        msg = json.dumps(event, default=str)
        async with self._lock:
            connections = list(self._connections)
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_text(msg)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        if dead:
            async with self._lock:
                for d in dead:
                    self._connections.discard(d)


manager = ConnectionManager()
