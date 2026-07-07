"""Append-only user journal — the panel's local SSOT for user-entered facts.

The SQLite DB is a derived read model and gets wiped on every retrain,
so anything the USER creates (approved orders, collection outcomes,
live WhatsApp traffic, dismissed suggestions) is appended here first —
one JSON object per line — and replayed into the DB at the end of each
pipeline run. Delete data/mirfix.db and nothing is lost.

If an Obsidian vault is configured the journal lives inside it
(<vault>/MIRFIX/Defter/events.jsonl) so it is versioned/synced together
with the user's notes; otherwise it falls back to data/journal/.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path

from .config import (DATA_DIR, VAULT_SUBDIR, VAULT_JOURNAL_DIR, vault_path)
from .database import now_iso
from .etl.whatsapp import Message, extract_signals, kind_for_group
from datetime import datetime

JOURNAL_FILE = "events.jsonl"


def journal_path() -> Path:
    vault = vault_path()
    if vault:
        d = vault / VAULT_SUBDIR / VAULT_JOURNAL_DIR
    else:
        d = DATA_DIR / "journal"
    d.mkdir(parents=True, exist_ok=True)
    return d / JOURNAL_FILE


def append_event(kind: str, payload: dict) -> dict:
    record = {"kind": kind, "ts": now_iso(),
              "uid": payload.get("uid") or uuid.uuid4().hex[:12],
              "payload": payload}
    with journal_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def read_events() -> list[dict]:
    path = journal_path()
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except ValueError:
            continue                      # a torn line must not kill the replay
    return events


# ---------------------------------------------------------------- apply
# One code path for both the live API write and the retrain replay, so
# they can never diverge.
def apply_event(conn: sqlite3.Connection, record: dict) -> str | None:
    kind, uid, p = record["kind"], record["uid"], record["payload"]

    if kind == "order":
        conn.execute(
            "INSERT OR IGNORE INTO order_record(order_uid, created_ts, customer, "
            "items, qty_pallet, qty_bag, amount, status, source, wa_msg_uid, note) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (uid, record["ts"], p.get("customer"), p.get("items"),
             p.get("qty_pallet"), p.get("qty_bag"), p.get("amount"),
             p.get("status", "yeni"), p.get("source", "manuel"),
             p.get("wa_msg_uid"), p.get("note")))
        return kind

    if kind == "order_status":
        conn.execute("UPDATE order_record SET status=? WHERE order_uid=?",
                     (p["status"], p["order_uid"]))
        return kind

    if kind == "collection":
        conn.execute(
            "INSERT OR IGNORE INTO collection_event(event_uid, created_ts, "
            "cari_title, kind, amount, due_date, note) VALUES (?,?,?,?,?,?,?)",
            (uid, record["ts"], p["cari_title"], p["collection_kind"],
             p.get("amount"), p.get("due_date"), p.get("note")))
        return kind

    if kind == "wa_live":
        group = p.get("group") or "WhatsApp Canlı"
        ts = p.get("msg_ts") or record["ts"]
        cur = conn.execute(
            "INSERT INTO wa_message(chat_group, msg_ts, sender, content, "
            "has_media, source_file, msg_uid) VALUES (?,?,?,?,?,?,?)",
            (group, ts, p.get("sender"), p.get("text", ""),
             int(bool(p.get("media"))), "canli", uid))
        msg = Message(ts=datetime.fromisoformat(ts[:19]),
                      sender=p.get("sender") or "?",
                      content=p.get("text", ""),
                      has_media=bool(p.get("media")))
        for sig in extract_signals(kind_for_group(group, default="order"), msg):
            conn.execute(
                "INSERT INTO wa_signal(message_id, signal_type, confidence, amount, "
                "qty_pallet, qty_bag, customer_hint, products, note) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (cur.lastrowid, sig["signal_type"], sig["confidence"], sig["amount"],
                 sig["qty_pallet"], sig["qty_bag"], sig["customer_hint"],
                 sig["products"], sig["note"]))
        return kind

    if kind == "wa_dismiss":
        conn.execute("INSERT OR IGNORE INTO wa_dismiss(msg_uid) VALUES (?)",
                     (p["msg_uid"],))
        return kind

    return None


def replay(conn: sqlite3.Connection) -> dict:
    counts: dict[str, int] = {}
    for record in read_events():
        applied = apply_event(conn, record)
        if applied:
            counts[applied] = counts.get(applied, 0) + 1
    conn.commit()
    return counts
