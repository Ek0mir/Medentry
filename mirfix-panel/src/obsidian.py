"""Obsidian vault bridge.

The vault is the user's knowledge SSOT; the panel plugs into it in
three ways (all plain files, no plugin required):

  <vault>/MIRFIX/Gelen/   -> extra source inbox: xlsx/txt dropped here
                             are ingested exactly like data/raw
  <vault>/MIRFIX/Defter/  -> the user journal (events.jsonl), see journal.py
  <vault>/MIRFIX/Panel/   -> markdown reports the panel writes after
                             every retrain, readable/linkable in Obsidian

Report content follows the canon: every number cites its source, and a
missing value is written as missing, never guessed.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from . import analytics
from .config import (VAULT_SUBDIR, VAULT_INBOX_DIR, VAULT_PANEL_DIR,
                     VAULT_JOURNAL_DIR, vault_path, APP_CODE, APP_VERSION)
from .database import now_iso


def vault_dirs(create: bool = False) -> dict[str, Path] | None:
    root = vault_path()
    if not root:
        return None
    base = root / VAULT_SUBDIR
    dirs = {"root": root, "base": base,
            "inbox": base / VAULT_INBOX_DIR,
            "panel": base / VAULT_PANEL_DIR,
            "journal": base / VAULT_JOURNAL_DIR}
    if create:
        for key in ("inbox", "panel", "journal"):
            dirs[key].mkdir(parents=True, exist_ok=True)
    return dirs


def vault_status() -> dict:
    dirs = vault_dirs()
    if not dirs:
        return {"bagli": False,
                "not_": "Vault yolu ayarlanmadı — MIRFIX_VAULT ortam değişkeni "
                        "ya da panel 09 · Veri & Sistem sekmesinden girilir."}
    inbox_files = sorted(p.name for p in dirs["inbox"].glob("*")
                         if p.is_file()) if dirs["inbox"].is_dir() else []
    reports = sorted(p.name for p in dirs["panel"].glob("*.md")) \
        if dirs["panel"].is_dir() else []
    journal = dirs["journal"] / "events.jsonl"
    return {"bagli": True, "yol": str(dirs["root"]),
            "gelen_dosyalar": inbox_files, "raporlar": reports,
            "defter_var": journal.exists(),
            "defter_yolu": str(journal)}


# ---------------------------------------------------------------- report
def _tl(v) -> str:
    return "—" if v is None else f"{v:,.0f} ₺".replace(",", ".")


def _table(headers: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) if c is not None else "—" for c in r) + " |")
    return "\n".join(out)


def export_reports(conn: sqlite3.Connection) -> dict:
    """Write the panel's core views as markdown notes into the vault."""
    dirs = vault_dirs(create=True)
    if not dirs:
        return {"status": "empty", "note": "vault ayarlanmadı"}
    stamp = now_iso()
    head = (f"---\nkaynak: {APP_CODE} v{APP_VERSION}\nguncelleme: {stamp}\n---\n\n")
    written = []

    ov = analytics.overview(conn)
    comp = analytics.compliance(conn)
    rules_rows = [[f"K{r['no']}", r["name"], r["status"].upper(),
                   f"g:{r['guven']}", r["detail"][:120]] for r in comp["rules"]]
    pano = (head + "# MİRFİX Pano Özeti\n\n"
            f"- **Nakit net ({ov['cash']['period'][0]} → {ov['cash']['period'][1]}):** "
            f"{_tl(ov['cash']['net'])} (giriş {_tl(ov['cash']['inflow'])} / "
            f"çıkış {_tl(ov['cash']['outflow'])}) — kaynak: {ov['cash']['kaynak']}\n"
            f"- **Eski kasa görünür alacak:** {_tl(ov['old_ledger']['amount'])} "
            f"({ov['old_ledger']['count']} cari)\n"
            f"- **OKR-O1 kurtarım:** {_tl(ov['okr_o1']['recovered'])} / "
            f"{_tl(ov['okr_o1']['target'])}\n"
            f"- **Eylem planı ihlali:** {ov['compliance_violations']} / 7 kural\n\n"
            "## Eylem Planı Uyum\n\n"
            + _table(["Kural", "Ad", "Durum", "Güven", "Bulgu"], rules_rows) + "\n")
    (dirs["panel"] / "Pano-Ozeti.md").write_text(pano, encoding="utf-8")
    written.append("Pano-Ozeti.md")

    orders = analytics.orders_list(conn, status=None, limit=200)
    open_orders = [o for o in orders if o["status"] not in ("kapandi", "iptal")]
    sip = (head + "# Sipariş Defteri\n\n"
           f"Açık sipariş: **{len(open_orders)}** · toplam kayıt: {len(orders)}\n\n"
           + _table(["Tarih", "Müşteri", "İçerik", "Palet", "Torba", "Tutar", "Durum", "Kaynak"],
                    [[o["created_ts"][:16].replace("T", " "), o["customer"], o["items"],
                      o["qty_pallet"], o["qty_bag"],
                      _tl(o["amount"]) if o["amount"] else "—",
                      o["status"], o["source"]] for o in orders[:100]]) + "\n")
    (dirs["panel"] / "Siparis-Defteri.md").write_text(sip, encoding="utf-8")
    written.append("Siparis-Defteri.md")

    evs = analytics.collections_list(conn, limit=200)
    summ = analytics.collections_summary(conn)
    tah = (head + "# Tahsilat Defteri (SRC-10 Sonuçları)\n\n"
           f"- **Kurtarılan (tahsil + mahsup):** {_tl(summ['recovered'])} / "
           f"{_tl(summ['target'])} hedef\n"
           f"- **Açık söz:** {_tl(summ['promised'])}\n\n"
           + _table(["Tarih", "Cari", "Tür", "Tutar", "Vade", "Not"],
                    [[e["created_ts"][:16].replace("T", " "), e["cari_title"], e["kind"],
                      _tl(e["amount"]) if e["amount"] else "—",
                      e["due_date"], e["note"]] for e in evs[:100]]) + "\n")
    (dirs["panel"] / "Tahsilat-Defteri.md").write_text(tah, encoding="utf-8")
    written.append("Tahsilat-Defteri.md")

    return {"status": "ok", "rows_in": len(written), "rows_loaded": len(written),
            "note": "vault raporları: " + ", ".join(written)}
