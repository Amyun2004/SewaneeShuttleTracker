"""WebSocket endpoint riders connect to for live shuttle updates."""
from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect, status

from app.security import decode_token
from app.ws_manager import manager

router = APIRouter()


@router.websocket("/live")
async def live(ws: WebSocket, access_token: str | None = Cookie(default=None)):
    """Live ping stream.

    Auth is OPTIONAL — riders without an account should still see the
    bus on the map. If a token IS present, it must be valid (no
    accepting tampered ones).
    """
    if access_token:
        payload = decode_token(access_token)
        if not payload or payload.get("typ") != "access":
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(ws)
    try:
        await ws.send_json({"type": "hello"})
        while True:
            # No client messages expected; this loop just keeps the
            # connection alive and detects disconnects.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)

