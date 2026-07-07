"""Excel ingestion: cash ledger + old-ledger (eski kasa) workbooks."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

from ..tr import tr_fold

CASH_SHEET = "Hareketler (Kategorili)"
OLD_RECEIVABLES_SHEET = "03_TAHSILAT_LISTESI"
OLD_PAYABLES_SHEET = "04_BORCLARIMIZ"


def _to_iso(raw) -> str | None:
    """'03.01.2026' or datetime -> '2026-01-03'."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date().isoformat()
    s = str(raw).strip()
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _num(raw) -> float:
    if raw is None or raw == "":
        return 0.0
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 0.0


def ingest_cash_workbook(conn: sqlite3.Connection, path: Path) -> dict:
    wb = load_workbook(path, read_only=True, data_only=True)
    if CASH_SHEET not in wb.sheetnames:
        return {"status": "empty", "note": f"'{CASH_SHEET}' sayfası bulunamadı"}
    ws = wb[CASH_SHEET]
    rows_in = rows_loaded = 0
    header_seen = False
    for row in ws.iter_rows(values_only=True):
        if not header_seen:                      # first row is the header
            header_seen = True
            continue
        rows_in += 1
        date_iso = _to_iso(row[0])
        if not date_iso:
            continue
        register, doc_type, desc, cparty, category = (
            (str(v).strip() if v is not None else None) for v in row[1:6]
        )
        inflow, outflow = _num(row[6]), _num(row[7] if len(row) > 7 else None)
        if inflow == 0 and outflow == 0:
            continue
        conn.execute(
            "INSERT INTO cash_entry(entry_date, register, doc_type, description, "
            "counterparty, category, inflow, outflow, source_file) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (date_iso, register, doc_type, desc, cparty, category,
             inflow, outflow, path.name),
        )
        rows_loaded += 1
    conn.commit()
    return {"status": "ok", "rows_in": rows_in, "rows_loaded": rows_loaded}


def ingest_old_ledger_workbook(conn: sqlite3.Connection, path: Path) -> dict:
    wb = load_workbook(path, read_only=True, data_only=True)
    loaded = {"receivables": 0, "payables": 0}

    if OLD_RECEIVABLES_SHEET in wb.sheetnames:
        ws = wb[OLD_RECEIVABLES_SHEET]
        first = True
        for row in ws.iter_rows(values_only=True):
            if first:
                first = False
                continue
            code, title, amount, active, evidence, cls, special, _bal26, note = (
                list(row) + [None] * 9)[:9]
            if title is None and amount is None:
                continue
            class_label = str(cls).strip() if cls else None
            class_code = class_label.split(" ")[0].strip("—- ") if class_label else None
            conn.execute(
                "INSERT INTO old_balance(ledger_code, title, amount, active_2026, "
                "evidence, class_label, class_code, special_flag, priority_note) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (str(code).strip() if code else None,
                 str(title).strip() if title else None,
                 _num(amount),
                 str(active).strip() if active else None,
                 str(evidence).strip() if evidence else None,
                 class_label,
                 class_code,
                 str(special).strip() if special else None,
                 str(note).strip() if note else None),
            )
            loaded["receivables"] += 1

    if OLD_PAYABLES_SHEET in wb.sheetnames:
        ws = wb[OLD_PAYABLES_SHEET]
        first = True
        for row in ws.iter_rows(values_only=True):
            if first:
                first = False
                continue
            code, title, amount, active, note = (list(row) + [None] * 5)[:5]
            if title is None and amount is None:
                continue
            conn.execute(
                "INSERT INTO payable_balance(ledger_code, title, amount, active_2026, note) "
                "VALUES (?,?,?,?,?)",
                (str(code).strip() if code else None,
                 str(title).strip() if title else None,
                 _num(amount),
                 str(active).strip() if active else None,
                 str(note).strip() if note else None),
            )
            loaded["payables"] += 1

    conn.commit()
    total = loaded["receivables"] + loaded["payables"]
    return {"status": "ok" if total else "empty",
            "rows_in": total, "rows_loaded": total, **loaded}


# ------------------------------------------------- generic cari / stok
# These workbooks come from the accounting program, so headers vary.
# Columns are located by fuzzy (folded) header names instead of fixed
# positions; a column that cannot be found is simply left NULL.
CARI_HEADER_HINTS = {
    "ledger_code": ("hesap kodu", "cari kod", "kod"),
    "title": ("unvan", "cari ad", "hesap adi", "musteri", "cari"),
    "debit": ("borc",),
    "credit": ("alacak",),
    "balance": ("bakiye",),
}
STOCK_HEADER_HINTS = {
    "code": ("stok kodu", "urun kodu", "kod"),
    "name": ("stok adi", "urun adi", "malzeme", "ad", "urun", "stok"),
    "unit": ("birim",),
    "qty": ("miktar", "adet", "mevcut"),
    "unit_price": ("birim fiyat", "fiyat"),
    "amount": ("tutar", "toplam"),
}


def _locate_header(ws, hints: dict, scan_rows: int = 10):
    """Find the header row and map field -> column index. Returns
    (header_row_index, mapping) or (None, None)."""
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=scan_rows,
                                         values_only=True)):
        folded = [tr_fold(str(c).strip()) if c is not None else "" for c in row]
        mapping: dict[str, int] = {}
        for field, frags in hints.items():
            for j, cell in enumerate(folded):
                if cell and any(cell == f or f in cell for f in frags) \
                        and j not in mapping.values():
                    mapping[field] = j
                    break
        if "title" in mapping or "name" in mapping:
            if len(mapping) >= 2:
                return i + 1, mapping
    return None, None


def _cell(row, mapping, field):
    j = mapping.get(field)
    if j is None or j >= len(row) or row[j] is None:
        return None
    return row[j]


def ingest_cari_workbook(conn: sqlite3.Connection, path: Path) -> dict:
    wb = load_workbook(path, read_only=True, data_only=True)
    rows_in = rows_loaded = 0
    for ws in wb.worksheets:
        header_row, mapping = _locate_header(ws, CARI_HEADER_HINTS)
        if not mapping:
            continue
        for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
            rows_in += 1
            title = _cell(row, mapping, "title")
            if title is None or str(title).strip() == "":
                continue
            conn.execute(
                "INSERT INTO current_balance(ledger_code, title, debit, credit, "
                "balance, source_file) VALUES (?,?,?,?,?,?)",
                (str(_cell(row, mapping, "ledger_code") or "").strip() or None,
                 str(title).strip(),
                 _num(_cell(row, mapping, "debit")),
                 _num(_cell(row, mapping, "credit")),
                 _num(_cell(row, mapping, "balance")),
                 path.name))
            rows_loaded += 1
        break                              # first sheet with a usable header wins
    conn.commit()
    return {"status": "ok" if rows_loaded else "empty",
            "rows_in": rows_in, "rows_loaded": rows_loaded,
            "note": None if rows_loaded else
            "başlık bulunamadı — beklenen sütunlar: unvan/cari + borç/alacak/bakiye"}


def ingest_stock_workbook(conn: sqlite3.Connection, path: Path) -> dict:
    wb = load_workbook(path, read_only=True, data_only=True)
    rows_in = rows_loaded = 0
    for ws in wb.worksheets:
        header_row, mapping = _locate_header(ws, STOCK_HEADER_HINTS)
        if not mapping:
            continue
        for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
            rows_in += 1
            name = _cell(row, mapping, "name")
            if name is None or str(name).strip() == "":
                continue
            conn.execute(
                "INSERT INTO stock_item(code, name, unit, qty, unit_price, "
                "amount, source_file) VALUES (?,?,?,?,?,?,?)",
                (str(_cell(row, mapping, "code") or "").strip() or None,
                 str(name).strip(),
                 str(_cell(row, mapping, "unit") or "").strip() or None,
                 _num(_cell(row, mapping, "qty")),
                 _num(_cell(row, mapping, "unit_price")),
                 _num(_cell(row, mapping, "amount")),
                 path.name))
            rows_loaded += 1
        break
    conn.commit()
    return {"status": "ok" if rows_loaded else "empty",
            "rows_in": rows_in, "rows_loaded": rows_loaded,
            "note": None if rows_loaded else
            "başlık bulunamadı — beklenen sütunlar: stok adı + miktar/fiyat"}
