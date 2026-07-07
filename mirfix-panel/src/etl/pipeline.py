"""Full ingest pipeline: the panel's 'self-training' loop.

Drop newer source files into data/raw and re-run (CLI `python run.py
--retrain` or the panel's 'Yeniden Eğit' button). The database is a
derived read model, so it is wiped and rebuilt from scratch each time —
DB-Bible §13 rebuildability, in miniature.
"""
from __future__ import annotations

import traceback

from ..config import (RAW_DIR, CASH_WORKBOOK_HINT, OLD_LEDGER_WORKBOOK_HINT,
                      CARI_WORKBOOK_HINT, STOCK_WORKBOOK_HINT, CHAT_GLOB)
from ..database import get_conn, init_db, reset_facts, log_event, now_iso
from ..tr import tr_fold
from ..seeds import seed
from .whatsapp import ingest_chat
from .workbooks import (ingest_cash_workbook, ingest_old_ledger_workbook,
                        ingest_cari_workbook, ingest_stock_workbook)


def source_dirs() -> list:
    """data/raw plus the Obsidian vault inbox when configured."""
    from ..obsidian import vault_dirs           # local import: avoids cycle
    dirs = [RAW_DIR]
    vd = vault_dirs()
    if vd and vd["inbox"].is_dir():
        dirs.append(vd["inbox"])
    return dirs


def _record(conn, source: str, result: dict) -> None:
    conn.execute(
        "INSERT INTO ingest_run(ran_at, source, status, rows_in, rows_loaded, note) "
        "VALUES (?,?,?,?,?,?)",
        (now_iso(), source, result.get("status", "ok"),
         result.get("rows_in", result.get("messages", 0)),
         result.get("rows_loaded", result.get("signals", 0)),
         result.get("note")),
    )
    conn.commit()


def run_all() -> dict:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    init_db(conn)
    reset_facts(conn)
    summary: dict = {"started": now_iso(), "sources": []}

    # -- seeds (product catalog + KPI definitions)
    s = seed(conn)
    _record(conn, "seed:katalog+kpi", {"status": "ok", "rows_in": sum(s.values()),
                                       "rows_loaded": sum(s.values())})
    summary["sources"].append({"source": "seed", **s})

    # -- discover raw files (data/raw + vault inbox); each file is
    #    claimed by the first matching hint, in this priority order
    files: list = []
    for d in source_dirs():
        if d.is_dir():
            files.extend(p for p in d.iterdir() if p.is_file())
    files.sort(key=lambda p: p.name)
    old_books = [p for p in files if OLD_LEDGER_WORKBOOK_HINT in tr_fold(p.name)]
    rest = [p for p in files if p not in old_books]
    cash_books = [p for p in rest if CASH_WORKBOOK_HINT in tr_fold(p.name)]
    rest = [p for p in rest if p not in cash_books]
    cari_books = [p for p in rest
                  if p.suffix.lower() in (".xlsx", ".xlsm")
                  and CARI_WORKBOOK_HINT in tr_fold(p.name)]
    rest = [p for p in rest if p not in cari_books]
    stock_books = [p for p in rest
                   if p.suffix.lower() in (".xlsx", ".xlsm")
                   and STOCK_WORKBOOK_HINT in tr_fold(p.name)]
    chats = sorted(p for p in files if p.match(CHAT_GLOB))

    for path in cash_books:
        try:
            r = ingest_cash_workbook(conn, path)
        except Exception as exc:                       # noqa: BLE001 - pipeline must not die
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, f"kasa:{path.name}", r)
        summary["sources"].append({"source": path.name, **r})

    for path in old_books:
        try:
            r = ingest_old_ledger_workbook(conn, path)
        except Exception as exc:                       # noqa: BLE001
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, f"eski-kasa:{path.name}", r)
        summary["sources"].append({"source": path.name, **r})

    for path in cari_books:
        try:
            r = ingest_cari_workbook(conn, path)
        except Exception as exc:                       # noqa: BLE001
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, f"cari:{path.name}", r)
        summary["sources"].append({"source": path.name, **r})

    for path in stock_books:
        try:
            r = ingest_stock_workbook(conn, path)
        except Exception as exc:                       # noqa: BLE001
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, f"stok:{path.name}", r)
        summary["sources"].append({"source": path.name, **r})

    for path in chats:
        try:
            r = ingest_chat(conn, path)
            r["status"] = "ok"
        except Exception as exc:                       # noqa: BLE001
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, f"whatsapp:{path.name}", r)
        summary["sources"].append({"source": path.name, **r})

    # -- replay the user journal (orders, collections, live WA traffic)
    from ..journal import replay
    try:
        counts = replay(conn)
        r = {"status": "ok", "rows_in": sum(counts.values()),
             "rows_loaded": sum(counts.values()),
             "note": ", ".join(f"{k}:{v}" for k, v in counts.items()) or "boş"}
    except Exception as exc:                           # noqa: BLE001
        r = {"status": "error", "note": f"{exc}"}
        traceback.print_exc()
    _record(conn, "defter:events.jsonl", r)
    summary["sources"].append({"source": "defter", **r})

    # -- refresh the vault markdown reports (when a vault is configured)
    from ..obsidian import export_reports, vault_dirs
    if vault_dirs():
        try:
            r = export_reports(conn)
        except Exception as exc:                       # noqa: BLE001
            r = {"status": "error", "note": f"{exc}"}
            traceback.print_exc()
        _record(conn, "obsidian:panel-raporlari", r)
        summary["sources"].append({"source": "obsidian", **r})

    log_event(conn, "PANEL.egitim_tamamlandi",
              {"kaynak_sayisi": len(summary["sources"])})
    summary["finished"] = now_iso()
    conn.close()
    return summary
