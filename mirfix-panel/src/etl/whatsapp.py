"""WhatsApp export ingestion.

Parses iOS-style exports:
    [4.07.2026 21:00:55] Sender Name: message text...
handles multi-line messages, invisible direction marks, media stubs and
system messages, then extracts typed business signals with a canon-style
confidence score (guven 0-3). No amount or quantity is ever guessed:
ambiguous numbers are skipped (AGENT-BIBLE: 'para/tarih alanında
varsayım yasak').
"""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from ..tr import tr_fold, strip_invisible, find_amounts

HEADER_RE = re.compile(
    r"^\[(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\]\s+([^:]+?):\s?(.*)$"
)
MEDIA_RE = re.compile(r"<[^>]*(?:eklendi|dahil edilmedi)[^>]*>|görüntü dahil edilmedi|dahil edilmedi")

SYSTEM_SNIPPETS = (
    "mesajlar ve aramalar uctan uca",
    "bu grubu olusturdu",
    "sizi ekledi",
    "eklendi\n",            # 'X eklendi' membership lines (folded)
    "bu mesaj silindi",
    "grubun aciklamasini degistirdi",
    "grup resmini degistirdi",
    "guvenlik kodu degisti",
)

# ---------------------------------------------------------------- keywords
PRODUCT_KEYWORDS = [
    "hazir siva", "siva", "levha yapistirici", "seramik yapistirici",
    "yapistirici", "derz", "dekoratif", "tamir harci", "granit",
    "gazbeton", "bims", "sertlestirici", "izolatex", "membran",
    "astar", "fayans", "levha sivasi", "saten", "alci", "file",
    "dubel", "kirec", "boya",
]
QTY_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(palet|torba|adet|cuval|kova|takim|koli|top)\b"
)
PAYMENT_KEYWORDS = [
    "odeme", "havale", "eft", "fast", "dekont", "yatti", "yatirdim",
    "gonderdim", "gonderildi", "tahsilat", "makbuz", "iban", "kalan",
    "cekildi", "odendi", "hesaba gecti",
]
CHEQUE_KEYWORDS = ["cek", "vade", "keside", "karsiliksiz"]
PRODUCTION_KEYWORDS = ["uretim", "vardiya", "durus", "ariza", "icmal", "makine", "mikser"]

GROUP_KIND = {  # folded group-name fragment -> logical kind
    "siparis": "order",
    "finans": "finance",
    "uretim": "production",
    "icmal": "production",
}


def kind_for_group(group_name: str, default: str = "other") -> str:
    """Map a chat/group name to a logical signal kind."""
    gf = tr_fold(group_name or "")
    for frag, k in GROUP_KIND.items():
        if frag in gf:
            return k
    return default


@dataclass
class Message:
    ts: datetime
    sender: str
    content: str
    has_media: bool = False
    lines: list[str] = field(default_factory=list)


def _is_system(folded: str) -> bool:
    return any(s in folded for s in SYSTEM_SNIPPETS)


def parse_chat(path: Path) -> tuple[str, list[Message]]:
    """Return (group_name, messages). Group name = sender of the first
    system line (WhatsApp uses the group itself as sender there)."""
    group_name = path.stem
    messages: list[Message] = []
    current: Message | None = None

    raw = path.read_text(encoding="utf-8", errors="replace")
    for raw_line in raw.splitlines():
        line = strip_invisible(raw_line).rstrip()
        m = HEADER_RE.match(line)
        if m:
            d, mo, y, hh, mi, ss, sender, body = m.groups()
            ts = datetime(int(y), int(mo), int(d), int(hh), int(mi), int(ss))
            if current:
                current.content = "\n".join(current.lines).strip()
                messages.append(current)
            current = Message(ts=ts, sender=sender.strip(), content="", lines=[body])
        elif current:
            current.lines.append(line)      # continuation of a multi-line message
    if current:
        current.content = "\n".join(current.lines).strip()
        messages.append(current)

    # group name: first line whose folded body is the encryption notice
    for msg in messages[:5]:
        if "uctan uca" in tr_fold(msg.content):
            group_name = msg.sender
            break

    # post-process: media + drop system messages
    clean: list[Message] = []
    for msg in messages:
        folded = tr_fold(msg.content)
        if MEDIA_RE.search(msg.content):
            msg.has_media = True
            msg.content = MEDIA_RE.sub("", msg.content).strip()
            folded = tr_fold(msg.content)
        if not msg.content and not msg.has_media:
            continue
        if msg.content and _is_system(folded + "\n"):
            continue
        if tr_fold(msg.sender) == tr_fold(group_name) and _is_system(folded + "\n"):
            continue
        clean.append(msg)
    return group_name, clean


# ---------------------------------------------------------------- signals
def _match_products(folded: str) -> list[str]:
    return [kw for kw in PRODUCT_KEYWORDS if kw in folded]


def _customer_hint(content: str, folded_first: str) -> str | None:
    """In the order group the first line is usually the customer name
    ('Fehmi daşcı\\n50 dekoratif sıva'). Accept it only if it carries no
    digits and no product keyword."""
    first = content.split("\n", 1)[0].strip()
    if not first or len(first) > 45 or any(ch.isdigit() for ch in first):
        return None
    if _match_products(folded_first):
        return None
    return first


def extract_signals(kind: str, msg: Message) -> list[dict]:
    """Classify one message into zero or more typed signals."""
    signals: list[dict] = []
    folded = tr_fold(msg.content)
    lines = msg.content.split("\n")
    folded_first = tr_fold(lines[0]) if lines else ""

    products = _match_products(folded)
    qtys = QTY_RE.findall(folded)
    pallets = sum(float(q.replace(",", ".")) for q, u in qtys if u == "palet")
    bags = sum(float(q.replace(",", ".")) for q, u in qtys if u == "torba")

    # ---- order (only meaningful in the order group)
    if kind == "order" and (products or qtys):
        conf = 3 if (products and qtys) else (2 if products else 1)
        signals.append({
            "signal_type": "order",
            "confidence": conf,
            "amount": None,
            "qty_pallet": pallets or None,
            "qty_bag": bags or None,
            "customer_hint": _customer_hint(msg.content, folded_first),
            "products": json.dumps(sorted(set(products)), ensure_ascii=False),
            "note": None,
        })

    # ---- payment / money movement
    if any(kw in folded for kw in PAYMENT_KEYWORDS):
        amounts = find_amounts(msg.content)
        conf = 3 if amounts else 1
        signals.append({
            "signal_type": "payment",
            "confidence": conf,
            "amount": max(amounts) if amounts else None,
            "qty_pallet": None, "qty_bag": None,
            "customer_hint": None,
            "products": None,
            "note": "tutar metinden" if amounts else "tutar belirsiz — metin sinyali",
        })

    # ---- cheque mentions
    if any(kw in folded for kw in CHEQUE_KEYWORDS) and "cek" in folded:
        amounts = find_amounts(msg.content)
        signals.append({
            "signal_type": "cheque",
            "confidence": 2 if amounts else 1,
            "amount": max(amounts) if amounts else None,
            "qty_pallet": None, "qty_bag": None,
            "customer_hint": None, "products": None, "note": None,
        })

    # ---- production: icmal photos + production talk
    if kind == "production":
        if msg.has_media:
            signals.append({
                "signal_type": "icmal_photo", "confidence": 2, "amount": None,
                "qty_pallet": None, "qty_bag": None, "customer_hint": None,
                "products": None, "note": "el yazısı icmal fotoğrafı (OCR: WF-06 kapsamı)",
            })
        elif any(kw in folded for kw in PRODUCTION_KEYWORDS):
            signals.append({
                "signal_type": "production", "confidence": 1, "amount": None,
                "qty_pallet": None, "qty_bag": None, "customer_hint": None,
                "products": None, "note": None,
            })
    return signals


def ingest_chat(conn: sqlite3.Connection, path: Path) -> dict:
    group_name, messages = parse_chat(path)
    kind = kind_for_group(group_name)

    n_sig = 0
    for msg in messages:
        cur = conn.execute(
            "INSERT INTO wa_message(chat_group, msg_ts, sender, content, has_media, source_file) "
            "VALUES (?,?,?,?,?,?)",
            (group_name, msg.ts.isoformat(timespec="seconds"), msg.sender,
             msg.content, int(msg.has_media), path.name),
        )
        mid = cur.lastrowid
        for sig in extract_signals(kind, msg):
            conn.execute(
                "INSERT INTO wa_signal(message_id, signal_type, confidence, amount, "
                "qty_pallet, qty_bag, customer_hint, products, note) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (mid, sig["signal_type"], sig["confidence"], sig["amount"],
                 sig["qty_pallet"], sig["qty_bag"], sig["customer_hint"],
                 sig["products"], sig["note"]),
            )
            n_sig += 1
    conn.commit()
    return {"group": group_name, "kind": kind,
            "messages": len(messages), "signals": n_sig}
