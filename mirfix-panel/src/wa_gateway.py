"""Live WhatsApp gateway — the panel's real-time order agent.

Two entry doors, one pipeline:

  POST /api/v1/wa/webhook  Meta WhatsApp Business Cloud API webhook
                           (GET on the same path answers Meta's
                           hub.challenge verification handshake)
  POST /api/v1/wa/gelen    generic bridge for any local forwarder
                           (whatsapp-web.js, Tasker, n8n...): plain
                           JSON {grup, gonderen, metin, zaman, medya}

Every inbound message is appended to the user journal (so it survives
retrains), stored as a wa_message row, run through the same signal
extractor as the archive ETL, and any order signal is pushed to the
browser over SSE. The agent only PROPOSES an order — a human approves
it in the panel (AI önerir, insan onaylar).
"""
from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import datetime

from .database import TZ_TR, get_conn, log_event
from .journal import append_event, apply_event


# ------------------------------------------------------------ SSE broker
class Broker:
    """Fan-out of JSON events to every open SSE connection."""

    def __init__(self) -> None:
        self.queues: set[asyncio.Queue] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    def attach(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self.queues.add(q)
        return q

    def detach(self, q: asyncio.Queue) -> None:
        self.queues.discard(q)

    def publish(self, event: dict) -> None:
        """Safe from both async handlers and worker threads."""
        def _put() -> None:
            for q in list(self.queues):
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass
        if self.loop and self.loop.is_running():
            self.loop.call_soon_threadsafe(_put)


broker = Broker()


async def sse_stream(q: asyncio.Queue):
    """Yield SSE frames; a comment ping every 25s keeps proxies alive."""
    try:
        yield ": bagli\n\n"
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=25)
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        broker.detach(q)


# ------------------------------------------------------- inbound message
def receive_message(group: str | None, sender: str | None, text: str,
                    msg_ts: str | None = None, media: bool = False) -> dict:
    """Journal + store + extract + broadcast one live message."""
    payload = {"group": group or "WhatsApp Canlı", "sender": sender,
               "text": text or "",
               "msg_ts": msg_ts or datetime.now(TZ_TR).isoformat(timespec="seconds"),
               "media": bool(media)}
    record = append_event("wa_live", payload)

    conn = get_conn()
    try:
        apply_event(conn, record)
        conn.commit()
        signals = [dict(r) for r in conn.execute(
            "SELECT s.signal_type, s.confidence, s.amount, s.qty_pallet, "
            "s.qty_bag, s.customer_hint, s.products "
            "FROM wa_signal s JOIN wa_message m ON m.id = s.message_id "
            "WHERE m.msg_uid = ?", (record["uid"],)).fetchall()]
        log_event(conn, "WA.canli_mesaj",
                  {"grup": payload["group"], "sinyal": len(signals)},
                  actor="agent:wa-gateway")
    finally:
        conn.close()

    for sig in signals:
        broker.publish({"tip": sig["signal_type"], "msg_uid": record["uid"],
                        "grup": payload["group"], "gonderen": sender,
                        "metin": (text or "")[:300],
                        "zaman": payload["msg_ts"],
                        "musteri": sig["customer_hint"],
                        "palet": sig["qty_pallet"], "torba": sig["qty_bag"],
                        "tutar": sig["amount"], "urunler": sig["products"],
                        "guven": sig["confidence"]})
    return {"msg_uid": record["uid"], "sinyaller": signals}


def parse_meta_webhook(body: dict) -> list[dict]:
    """Flatten a Meta Cloud API webhook payload into simple messages."""
    out: list[dict] = []
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            names = {c.get("wa_id"): c.get("profile", {}).get("name")
                     for c in value.get("contacts", [])}
            phone = value.get("metadata", {}).get("display_phone_number")
            for m in value.get("messages", []):
                mtype = m.get("type")
                text = ""
                if mtype == "text":
                    text = m.get("text", {}).get("body", "")
                elif isinstance(m.get(mtype), dict):
                    text = m[mtype].get("caption", "")
                ts = m.get("timestamp")
                iso = (datetime.fromtimestamp(int(ts), TZ_TR)
                       .isoformat(timespec="seconds")) if ts else None
                out.append({"group": f"WA Cloud · {phone}" if phone else "WA Cloud",
                            "sender": names.get(m.get("from")) or m.get("from"),
                            "text": text, "msg_ts": iso,
                            "media": mtype not in (None, "text")})
    return out


# --------------------------------------------------- pending suggestions
def order_suggestions(conn: sqlite3.Connection, limit: int = 30) -> list[dict]:
    """Live order signals not yet approved into an order nor dismissed."""
    return [dict(r) for r in conn.execute(
        "SELECT m.msg_uid, m.msg_ts, m.chat_group, m.sender, m.content, "
        "s.confidence, s.amount, s.qty_pallet, s.qty_bag, s.customer_hint, s.products "
        "FROM wa_signal s JOIN wa_message m ON m.id = s.message_id "
        "WHERE s.signal_type = 'order' AND m.source_file = 'canli' "
        "AND m.msg_uid NOT IN (SELECT wa_msg_uid FROM order_record "
        "                      WHERE wa_msg_uid IS NOT NULL) "
        "AND m.msg_uid NOT IN (SELECT msg_uid FROM wa_dismiss) "
        "ORDER BY m.msg_ts DESC LIMIT ?", (min(limit, 100),)).fetchall()]
