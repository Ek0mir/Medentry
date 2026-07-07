"""SQLite access layer.

Derived, fully rebuildable read model (drop data/mirfix.db and re-run
the pipeline to reconstruct it from data/raw). English snake_case
identifiers per PO rule; Turkish business text lives in the rows.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone, timedelta

from .config import DB_PATH, DATA_DIR

TZ_TR = timezone(timedelta(hours=3))

SCHEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS product (
    id            INTEGER PRIMARY KEY,
    code          TEXT UNIQUE NOT NULL,          -- MFX-*
    name          TEXT NOT NULL,
    group_code    TEXT NOT NULL,                 -- SV/YP/DZ/YS/SU/AS/BY/TM
    group_name    TEXT NOT NULL,
    package_info  TEXT,
    list_price    REAL,                          -- NULL => '[FİYAT GİRİNİZ]'
    price_note    TEXT,
    is_trade_good INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cash_entry (
    id           INTEGER PRIMARY KEY,
    entry_date   TEXT NOT NULL,                  -- ISO yyyy-mm-dd
    register     TEXT,                           -- '100 NAKİT KASA' / 'ANA KASA'
    doc_type     TEXT,
    description  TEXT,
    counterparty TEXT,
    category     TEXT,
    inflow       REAL NOT NULL DEFAULT 0,
    outflow      REAL NOT NULL DEFAULT 0,
    source_file  TEXT
);
CREATE INDEX IF NOT EXISTS ix_cash_date ON cash_entry(entry_date);
CREATE INDEX IF NOT EXISTS ix_cash_category ON cash_entry(category);
CREATE INDEX IF NOT EXISTS ix_cash_counterparty ON cash_entry(counterparty);

CREATE TABLE IF NOT EXISTS old_balance (
    id            INTEGER PRIMARY KEY,
    ledger_code   TEXT,
    title         TEXT,
    amount        REAL,
    active_2026   TEXT,                          -- 'AKTİF' / '—'
    evidence      TEXT,                          -- WhatsApp evidence token
    class_label   TEXT,                          -- full label from workbook
    class_code    TEXT,                          -- A/B/C/D/E/X/G ...
    special_flag  TEXT,
    priority_note TEXT
);
CREATE INDEX IF NOT EXISTS ix_old_class ON old_balance(class_code);

CREATE TABLE IF NOT EXISTS payable_balance (
    id          INTEGER PRIMARY KEY,
    ledger_code TEXT,
    title       TEXT,
    amount      REAL,                            -- negative: we owe them
    active_2026 TEXT,
    note        TEXT
);

CREATE TABLE IF NOT EXISTS wa_message (
    id          INTEGER PRIMARY KEY,
    chat_group  TEXT NOT NULL,
    msg_ts      TEXT NOT NULL,                   -- ISO datetime
    sender      TEXT,
    content     TEXT,
    has_media   INTEGER NOT NULL DEFAULT 0,
    source_file TEXT,                            -- file name, or 'canli' for live agent traffic
    msg_uid     TEXT                             -- stable uid for live messages (journal replay)
);
CREATE INDEX IF NOT EXISTS ix_wa_ts ON wa_message(msg_ts);
CREATE INDEX IF NOT EXISTS ix_wa_group ON wa_message(chat_group);

CREATE TABLE IF NOT EXISTS wa_signal (
    id            INTEGER PRIMARY KEY,
    message_id    INTEGER NOT NULL REFERENCES wa_message(id),
    signal_type   TEXT NOT NULL,                 -- order/payment/cheque/production/icmal_photo
    confidence    INTEGER NOT NULL,              -- 0..3 (canon 'guven')
    amount        REAL,
    qty_pallet    REAL,
    qty_bag       REAL,
    customer_hint TEXT,
    products      TEXT,                          -- JSON array of matched keywords
    note          TEXT
);
CREATE INDEX IF NOT EXISTS ix_sig_type ON wa_signal(signal_type);

CREATE TABLE IF NOT EXISTS kpi_definition (
    id           INTEGER PRIMARY KEY,
    code         TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    department   TEXT NOT NULL,
    unit         TEXT,
    target_value REAL,
    red_value    REAL,
    direction    TEXT NOT NULL,                  -- 'up' target is a floor / 'down' a ceiling
    source_note  TEXT
);

CREATE TABLE IF NOT EXISTS order_record (             -- user-approved orders (journal-backed)
    id          INTEGER PRIMARY KEY,
    order_uid   TEXT UNIQUE NOT NULL,
    created_ts  TEXT NOT NULL,
    customer    TEXT,
    items       TEXT,                            -- free text: products / quantities
    qty_pallet  REAL,
    qty_bag     REAL,
    amount      REAL,
    status      TEXT NOT NULL DEFAULT 'yeni',    -- yeni / hazirlaniyor / sevk / kapandi / iptal
    source      TEXT NOT NULL DEFAULT 'manuel',  -- manuel / whatsapp
    wa_msg_uid  TEXT,                            -- live WA message this order was approved from
    note        TEXT
);
CREATE INDEX IF NOT EXISTS ix_order_status ON order_record(status);

CREATE TABLE IF NOT EXISTS collection_event (          -- SRC-10 outcome records (journal-backed)
    id          INTEGER PRIMARY KEY,
    event_uid   TEXT UNIQUE NOT NULL,
    created_ts  TEXT NOT NULL,
    cari_title  TEXT NOT NULL,
    kind        TEXT NOT NULL,                   -- soz / tahsil / mahsup
    amount      REAL,
    due_date    TEXT,                            -- promised date for 'soz'
    note        TEXT
);

CREATE TABLE IF NOT EXISTS wa_dismiss (                -- dismissed live order suggestions
    msg_uid     TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS current_balance (           -- cari (current-account) workbook
    id          INTEGER PRIMARY KEY,
    ledger_code TEXT,
    title       TEXT,
    debit       REAL,
    credit      REAL,
    balance     REAL,
    source_file TEXT
);
CREATE INDEX IF NOT EXISTS ix_curbal_title ON current_balance(title);

CREATE TABLE IF NOT EXISTS stock_item (                -- stok workbook
    id          INTEGER PRIMARY KEY,
    code        TEXT,
    name        TEXT,
    unit        TEXT,
    qty         REAL,
    unit_price  REAL,
    amount      REAL,
    source_file TEXT
);

CREATE TABLE IF NOT EXISTS ingest_run (
    id          INTEGER PRIMARY KEY,
    ran_at      TEXT NOT NULL,
    source      TEXT NOT NULL,
    status      TEXT NOT NULL,                   -- ok / empty / error
    rows_in     INTEGER NOT NULL DEFAULT 0,
    rows_loaded INTEGER NOT NULL DEFAULT 0,
    note        TEXT
);

CREATE TABLE IF NOT EXISTS event_log (                -- append-only, EA-Bible §4 flavour
    id         INTEGER PRIMARY KEY,
    event_code TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ts         TEXT NOT NULL,
    actor      TEXT NOT NULL,
    payload    TEXT,
    trace_id   TEXT
);
"""

# child tables first: wa_signal references wa_message.
# order_record / collection_event / wa_dismiss are wiped too, then
# replayed from the append-only user journal (journal.py) — the DB
# stays fully rebuildable while user entries survive every retrain.
FACT_TABLES = ("wa_signal", "wa_message", "cash_entry", "old_balance",
               "payable_balance", "product", "kpi_definition",
               "order_record", "collection_event", "wa_dismiss",
               "current_balance", "stock_item")

SCHEMA_VERSION = 2


def now_iso() -> str:
    return datetime.now(TZ_TR).isoformat(timespec="seconds")


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _schema_stale(conn: sqlite3.Connection) -> bool:
    if conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
        return True
    # sentinel: a column CREATE IF NOT EXISTS cannot retrofit
    cols = [r[1] for r in conn.execute("PRAGMA table_info(wa_message)")]
    return bool(cols) and "msg_uid" not in cols


def init_db(conn: sqlite3.Connection) -> None:
    # Derived read model: on any schema bump just drop everything and let
    # the pipeline rebuild from sources + journal (DB-Bible §13).
    if _schema_stale(conn):
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        for t in tables:
            conn.execute(f"DROP TABLE IF EXISTS {t}")
        conn.commit()
    conn.executescript(SCHEMA)
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def reset_facts(conn: sqlite3.Connection) -> None:
    """Wipe derived tables before a full re-ingest (rebuildability)."""
    for t in FACT_TABLES:
        conn.execute(f"DELETE FROM {t}")
    conn.commit()


def log_event(conn: sqlite3.Connection, event_type: str, payload: dict,
              actor: str = "system:pipeline", trace_id: str | None = None) -> str:
    n = conn.execute("SELECT COUNT(*) FROM event_log").fetchone()[0] + 1
    code = f"EV-{datetime.now(TZ_TR).year}-{n:06d}"
    conn.execute(
        "INSERT INTO event_log(event_code, event_type, ts, actor, payload, trace_id) "
        "VALUES (?,?,?,?,?,?)",
        (code, event_type, now_iso(), actor,
         json.dumps(payload, ensure_ascii=False), trace_id or code),
    )
    conn.commit()
    return code
