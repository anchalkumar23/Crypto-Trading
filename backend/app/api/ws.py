"""WebSocket endpoint — pushes engine ticks, trade events, prices."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        # Send a hello so the UI shows connection state immediately.
        await ws.send_json({"type": "hello", "data": {"v": 1}})
        while True:
            # We don't process inbound messages yet — channels are server-driven.
            data = await ws.receive_text()
            # Echo subscriptions back for debugging.
            await ws.send_json({"type": "ack", "data": data})
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:  # noqa: BLE001
        await manager.disconnect(ws)
