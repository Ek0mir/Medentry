"""Read-side analytics: every number the dashboard shows is computed
here, and every payload carries its source ('kaynak') — the canon's
'kaynaksız iddia geçersiz' rule applied to UI.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from .config import (RULE_ADVANCE_MONTHLY_LIMIT, RULE_KITCHEN_WEEKLY_BUDGET,
                     RULE_CASH_EOD_LIMIT, RULE_QUOTE_THRESHOLD,
                     RELATED_PARTY_HINTS, PERSONAL_CARD_HINTS,
                     OKR_OLD_LEDGER_TARGET, SIGNAL_WINDOW_DAYS,
                     STALE_AFTER_HOURS)
from .database import TZ_TR
from .tr import tr_fold


def _rows(conn: sqlite3.Connection, sql: str, params=()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _one(conn: sqlite3.Connection, sql: str, params=()):
    row = conn.execute(sql, params).fetchone()
    return row[0] if row and row[0] is not None else 0


# ================================================================ overview
def overview(conn: sqlite3.Connection) -> dict:
    cash_period = conn.execute(
        "SELECT MIN(entry_date) a, MAX(entry_date) b, "
        "SUM(inflow) i, SUM(outflow) o FROM cash_entry").fetchone()
    old_total = conn.execute(
        "SELECT COUNT(*) c, SUM(amount) s FROM old_balance WHERE amount > 0").fetchone()
    old_active_a = conn.execute(
        "SELECT COUNT(*) c, SUM(amount) s FROM old_balance "
        "WHERE class_code='A' AND amount > 0").fetchone()

    last_wa = conn.execute("SELECT MAX(msg_ts) FROM wa_message").fetchone()[0]
    window_start = None
    if last_wa:
        window_start = (datetime.fromisoformat(last_wa)
                        - timedelta(days=SIGNAL_WINDOW_DAYS)).isoformat()

    order_sig = conn.execute(
        "SELECT COUNT(*) c, SUM(COALESCE(s.qty_pallet,0)) p, "
        "SUM(COALESCE(s.qty_bag,0)) b FROM wa_signal s "
        "JOIN wa_message m ON m.id = s.message_id "
        "WHERE s.signal_type='order' AND (? IS NULL OR m.msg_ts >= ?)",
        (window_start, window_start)).fetchone()
    pay_amt = _one(conn,
        "SELECT SUM(amount) FROM wa_signal WHERE signal_type='payment' AND amount IS NOT NULL")

    top_expense = conn.execute(
        "SELECT counterparty, SUM(outflow) s FROM cash_entry "
        "WHERE outflow > 0 GROUP BY counterparty ORDER BY s DESC LIMIT 1").fetchone()

    comp = compliance(conn)
    violations = sum(1 for r in comp["rules"] if r["status"] == "ihlal")

    last_ingest = conn.execute("SELECT MAX(ran_at) FROM ingest_run").fetchone()[0]
    stale = True
    if last_ingest:
        age_h = (datetime.now(TZ_TR)
                 - datetime.fromisoformat(last_ingest)).total_seconds() / 3600
        stale = age_h > STALE_AFTER_HOURS

    price_gaps = _one(conn,
        "SELECT COUNT(*) FROM product WHERE list_price IS NULL AND is_trade_good=0")

    recovered = comp["okr_recovered"]
    return {
        "cash": {
            "period": [cash_period["a"], cash_period["b"]],
            "inflow": cash_period["i"] or 0, "outflow": cash_period["o"] or 0,
            "net": (cash_period["i"] or 0) - (cash_period["o"] or 0),
            "kaynak": "Kasa hareket dökümü (xlsx)",
        },
        "old_ledger": {
            "count": old_total["c"], "amount": old_total["s"] or 0,
            "active_a_count": old_active_a["c"], "active_a_amount": old_active_a["s"] or 0,
            "kaynak": "Eski_Kasa_Tahsilat_Analizi (06.07 çalışması)",
        },
        "okr_o1": {
            "target": OKR_OLD_LEDGER_TARGET, "recovered": recovered,
            "kaynak": "BOS §6.2 OKR-O1/KR1 — panel tahsilat defteri (tahsil+mahsup)",
        },
        "orders": {
            "open_count": _one(conn,
                "SELECT COUNT(*) FROM order_record "
                "WHERE status NOT IN ('kapandi','iptal')"),
            "total_count": _one(conn, "SELECT COUNT(*) FROM order_record"),
            "kaynak": "Sipariş defteri (panel girişleri + WA onayları)",
        },
        "wa": {
            "order_signals": order_sig["c"], "order_pallets": order_sig["p"] or 0,
            "order_bags": order_sig["b"] or 0, "window_days": SIGNAL_WINDOW_DAYS,
            "payment_signal_amount": pay_amt,
            "kaynak": "WhatsApp arşivleri (_chat*.txt)",
        },
        "top_expense": {
            "counterparty": top_expense["counterparty"] if top_expense else None,
            "amount": top_expense["s"] if top_expense else 0,
            "kaynak": "Kasa hareket dökümü",
        },
        "compliance_violations": violations,
        "price_gaps": price_gaps,
        "freshness": {"last_ingest": last_ingest, "last_wa": last_wa,
                      "last_cash": cash_period["b"], "stale": stale},
    }


# ==================================================================== cash
def cash_monthly(conn) -> list[dict]:
    return _rows(conn,
        "SELECT substr(entry_date,1,7) month, SUM(inflow) inflow, "
        "SUM(outflow) outflow, SUM(inflow)-SUM(outflow) net, COUNT(*) n "
        "FROM cash_entry GROUP BY month ORDER BY month")


def cash_categories(conn) -> list[dict]:
    return _rows(conn,
        "SELECT COALESCE(category,'(kategorisiz)') category, "
        "SUM(outflow) outflow, SUM(inflow) inflow, COUNT(*) n "
        "FROM cash_entry GROUP BY category ORDER BY outflow DESC")


def cash_counterparties(conn, direction: str = "out", limit: int = 20) -> list[dict]:
    col = "outflow" if direction == "out" else "inflow"
    return _rows(conn,
        f"SELECT COALESCE(counterparty,'(boş)') counterparty, SUM({col}) total, COUNT(*) n "
        f"FROM cash_entry WHERE {col} > 0 GROUP BY counterparty "
        f"ORDER BY total DESC LIMIT ?", (limit,))


def cash_entries(conn, q: str | None = None, category: str | None = None,
                 limit: int = 100) -> list[dict]:
    sql = ("SELECT entry_date, register, doc_type, description, counterparty, "
           "category, inflow, outflow FROM cash_entry WHERE 1=1")
    params: list = []
    if q:
        sql += " AND (description LIKE ? OR counterparty LIKE ?)"
        params += [f"%{q}%", f"%{q}%"]
    if category:
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY entry_date DESC, id DESC LIMIT ?"
    params.append(min(limit, 500))
    return _rows(conn, sql, params)


# ============================================================== compliance
def _fold_match(text: str | None, hints) -> bool:
    if not text:
        return False
    f = tr_fold(text)
    return any(tr_fold(h) in f for h in hints)


def compliance(conn: sqlite3.Connection) -> dict:
    """Action-plan (06.07.2026) 7 rules, computed from the ledger.
    Honesty first: rules whose evidence is not in the data are marked
    'veri-yok' instead of being guessed."""
    rules: list[dict] = []

    # R1 — no uncategorised spending ('Diğer' + the MİRFİX torba account)
    other = conn.execute(
        "SELECT COUNT(*) n, SUM(outflow) s FROM cash_entry "
        "WHERE category='Diğer' AND outflow > 0").fetchone()
    torba = conn.execute(
        "SELECT COUNT(*) n, SUM(outflow) s FROM cash_entry "
        "WHERE counterparty LIKE '%FABRİKA GİDERLERİ%' AND outflow > 0").fetchone()
    rules.append({
        "no": 1, "name": "Kategorisiz / torba hesap harcaması",
        "limit": "0 işlem/ay",
        "status": "ihlal" if (other["n"] or 0) > 0 else "uygun",
        "detail": (f"'Diğer' kategorisinde {other['n']} işlem / {other['s'] or 0:,.0f} ₺; "
                   f"'MİRFİX FABRİKA GİDERLERİ' torba hesabında {torba['n']} işlem / "
                   f"{torba['s'] or 0:,.0f} ₺"),
        "guven": 3, "kaynak": "cash_entry.category / counterparty",
    })

    # R2 — no company payments from personal cards
    card_rows = _rows(conn,
        "SELECT entry_date, description, counterparty, outflow FROM cash_entry "
        "WHERE outflow > 0 AND description IS NOT NULL")
    hits = [r for r in card_rows if _fold_match(r["description"], PERSONAL_CARD_HINTS)]
    card_sum = sum(r["outflow"] for r in hits)
    rules.append({
        "no": 2, "name": "Şahsi kartla şirket ödemesi",
        "limit": "0 ₺ (1 Eylül 2026 sonrası)",
        "status": "ihlal" if hits else "uygun",
        "detail": f"{len(hits)} kart-izli işlem, {card_sum:,.0f} ₺ "
                  f"(anahtar kelime taraması — guven:2)",
        "guven": 2, "kaynak": "cash_entry.description (KUVEYT/HAPPY/VAKIF...)",
        "rows": hits[:15],
    })

    # R3 — end-of-day physical cash <= 100K (needs daily balances)
    rules.append({
        "no": 3, "name": "Gün sonu fiziki kasa ≤ 100.000 ₺",
        "limit": f"≤ {RULE_CASH_EOD_LIMIT:,.0f} ₺",
        "status": "veri-yok",
        "detail": "Hareket dökümünde açılış/kapanış bakiyesi yok; günlük kasa "
                  "mutabakat formu akmaya başlayınca hesaplanır.",
        "guven": 0, "kaynak": "—",
    })

    # R4 — personnel advance <= 10K / person / month (single-entry proxy)
    adv = _rows(conn,
        "SELECT entry_date, description, outflow FROM cash_entry "
        "WHERE category LIKE 'Personel%' AND outflow > ? "
        "ORDER BY outflow DESC LIMIT 20", (RULE_ADVANCE_MONTHLY_LIMIT,))
    adv_total = _one(conn,
        "SELECT SUM(outflow) FROM cash_entry WHERE category LIKE 'Personel%'")
    rules.append({
        "no": 4, "name": "Personel avansı ≤ 10.000 ₺/kişi/ay",
        "limit": f"≤ {RULE_ADVANCE_MONTHLY_LIMIT:,.0f} ₺",
        "status": "ihlal" if adv else "uygun",
        "detail": (f"Tek kalemde limit üstü {len(adv)} ödeme; personel kategorisi "
                   f"toplamı {adv_total:,.0f} ₺. Kişi-bazlı aylık takip için "
                   f"personel cari hesabı gerekli (guven:1 — vekil ölçüm)."),
        "guven": 1, "kaynak": "cash_entry.category='Personel…'", "rows": adv,
    })

    # R5 — 3 quotes for >= 50K purchases (evidence lives outside the ledger)
    big_buys = _one(conn,
        "SELECT COUNT(*) FROM cash_entry WHERE outflow >= ? "
        "AND category LIKE 'Hammadde%'", (RULE_QUOTE_THRESHOLD,))
    rules.append({
        "no": 5, "name": "≥ 50.000 ₺ alımda 3 teklif",
        "limit": "3 teklif belgesi",
        "status": "veri-yok",
        "detail": f"Dökümde eşik üstü {big_buys} hammadde ödemesi var; teklif "
                  "kanıtı satınalma dosyasında tutulur, kasadan doğrulanamaz.",
        "guven": 0, "kaynak": "—",
    })

    # R6 — partner/related-party flows must not leave the till directly
    rel_rows = _rows(conn,
        "SELECT counterparty, SUM(inflow) inflow, SUM(outflow) outflow, COUNT(*) n "
        "FROM cash_entry GROUP BY counterparty")
    rel = [r for r in rel_rows if _fold_match(r["counterparty"], RELATED_PARTY_HINTS)]
    rel_out = sum(r["outflow"] for r in rel)
    rules.append({
        "no": 6, "name": "Ortak/ilişkili tarafa kasadan doğrudan çıkış",
        "limit": "0 (ortaklar cari hesabından)",
        "status": "ihlal" if rel_out > 0 else "uygun",
        "detail": "; ".join(f"{r['counterparty']}: çıkış {r['outflow']:,.0f} ₺ / "
                            f"giriş {r['inflow']:,.0f} ₺" for r in rel) or "kayıt yok",
        "guven": 3, "kaynak": "cash_entry.counterparty (ALİ ÖZDEMİR, EKOMİR)",
    })

    # R7 — kitchen/market weekly budget <= 3K
    weeks = _rows(conn,
        "SELECT strftime('%Y-%W', entry_date) week, SUM(outflow) s, COUNT(*) n "
        "FROM cash_entry WHERE category LIKE 'Mutfak%' AND outflow > 0 "
        "GROUP BY week ORDER BY week")
    over = [w for w in weeks if w["s"] > RULE_KITCHEN_WEEKLY_BUDGET]
    rules.append({
        "no": 7, "name": "Mutfak/market haftalık bütçe ≤ 3.000 ₺",
        "limit": f"≤ {RULE_KITCHEN_WEEKLY_BUDGET:,.0f} ₺/hafta",
        "status": "ihlal" if over else "uygun",
        "detail": f"{len(weeks)} haftanın {len(over)}'i bütçe üstü; en yükseği "
                  + (f"{max((w['s'] for w in over), default=0):,.0f} ₺" if over else "—"),
        "guven": 3, "kaynak": "cash_entry.category='Mutfak / market / yemek'",
        "rows": over,
    })

    # OKR-O1 recovered: real SRC-10 outcome records from the panel journal.
    recovered = _one(conn,
        "SELECT SUM(amount) FROM collection_event "
        "WHERE kind IN ('tahsil','mahsup') AND amount IS NOT NULL")
    return {"rules": rules, "okr_recovered": recovered,
            "not_": "Durumlar dönemin tamamı üzerinden hesaplanır; kural metni "
                    "Mirfix_Eylem_Planı (06.07.2026) genelgesindendir."}


# =============================================================== old ledger
def old_ledger_summary(conn) -> dict:
    by_class = _rows(conn,
        "SELECT COALESCE(class_code,'?') class_code, "
        "MAX(COALESCE(class_label,'')) class_label, COUNT(*) n, SUM(amount) s "
        "FROM old_balance WHERE amount > 0 GROUP BY class_code ORDER BY s DESC")
    active = conn.execute(
        "SELECT COUNT(*) n, SUM(amount) s FROM old_balance "
        "WHERE amount > 0 AND active_2026='AKTİF'").fetchone()
    payables = conn.execute(
        "SELECT COUNT(*) n, SUM(amount) s FROM payable_balance").fetchone()
    recovered = _one(conn,
        "SELECT SUM(amount) FROM collection_event "
        "WHERE kind IN ('tahsil','mahsup') AND amount IS NOT NULL")
    return {
        "by_class": by_class,
        "active": {"n": active["n"], "s": active["s"] or 0},
        "payables": {"n": payables["n"], "s": payables["s"] or 0},
        "okr_target": OKR_OLD_LEDGER_TARGET,
        "okr_recovered": recovered,
        "kaynak": "Eski_Kasa_Tahsilat_Analizi_v1.1.xlsx / 03+04 sayfaları",
    }


def old_ledger_top(conn, class_code: str | None = None, limit: int = 25) -> list[dict]:
    sql = ("SELECT ledger_code, title, amount, active_2026, evidence, "
           "class_code, class_label, priority_note FROM old_balance WHERE amount > 0")
    params: list = []
    if class_code:
        sql += " AND class_code = ?"
        params.append(class_code)
    sql += " ORDER BY amount DESC LIMIT ?"
    params.append(min(limit, 200))
    return _rows(conn, sql, params)


def mahsup_opportunities(conn, limit: int = 15) -> list[dict]:
    return _rows(conn,
        "SELECT ledger_code, title, amount, active_2026, note FROM payable_balance "
        "ORDER BY amount ASC LIMIT ?", (limit,))


# ================================================================ whatsapp
def wa_summary(conn) -> dict:
    groups = _rows(conn,
        "SELECT chat_group, COUNT(*) n, SUM(has_media) media, "
        "MIN(msg_ts) a, MAX(msg_ts) b FROM wa_message GROUP BY chat_group")
    signals = _rows(conn,
        "SELECT signal_type, COUNT(*) n, SUM(COALESCE(amount,0)) amount, "
        "AVG(confidence) avg_conf FROM wa_signal GROUP BY signal_type ORDER BY n DESC")
    timeline = _rows(conn,
        "SELECT substr(msg_ts,1,7) month, chat_group, COUNT(*) n "
        "FROM wa_message GROUP BY month, chat_group ORDER BY month")
    return {"groups": groups, "signals": signals, "timeline": timeline,
            "kaynak": "WhatsApp dışa aktarımları"}


def wa_signals(conn, signal_type: str = "order", limit: int = 40) -> list[dict]:
    return _rows(conn,
        "SELECT m.msg_ts, m.chat_group, m.sender, m.content, s.signal_type, "
        "s.confidence, s.amount, s.qty_pallet, s.qty_bag, s.customer_hint, s.products "
        "FROM wa_signal s JOIN wa_message m ON m.id = s.message_id "
        "WHERE s.signal_type = ? ORDER BY m.msg_ts DESC LIMIT ?",
        (signal_type, min(limit, 200)))


# ================================================================= products
def products(conn) -> dict:
    items = _rows(conn,
        "SELECT code, name, group_code, group_name, package_info, list_price, "
        "price_note, is_trade_good FROM product ORDER BY code")
    gaps = [p for p in items if p["list_price"] is None and not p["is_trade_good"]]
    return {"items": items, "gaps": gaps,
            "kaynak": "MRF-SAT-FYT v1 (05.07.2026) — v1.1 ALMİR antetiyle aynı fiyatlar"}


def kpis(conn) -> list[dict]:
    return _rows(conn,
        "SELECT code, name, department, unit, target_value, red_value, "
        "direction, source_note FROM kpi_definition ORDER BY department, code")


# ============================================================ orders
def orders_list(conn, status: str | None = None, limit: int = 100) -> list[dict]:
    sql = ("SELECT order_uid, created_ts, customer, items, qty_pallet, qty_bag, "
           "amount, status, source, wa_msg_uid, note FROM order_record")
    params: list = []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    else:
        sql += " WHERE 1=1"
    sql += " ORDER BY created_ts DESC LIMIT ?"
    params.append(min(limit, 500))
    return _rows(conn, sql, params)


def orders_summary(conn) -> dict:
    by_status = _rows(conn,
        "SELECT status, COUNT(*) n, SUM(COALESCE(qty_pallet,0)) p, "
        "SUM(COALESCE(qty_bag,0)) b, SUM(COALESCE(amount,0)) s "
        "FROM order_record GROUP BY status")
    today = _one(conn,
        "SELECT COUNT(*) FROM order_record WHERE substr(created_ts,1,10) = date('now')")
    return {"by_status": by_status, "today": today,
            "kaynak": "Sipariş defteri (journal → order_record)"}


# ======================================================== collections
def collections_list(conn, limit: int = 100) -> list[dict]:
    return _rows(conn,
        "SELECT event_uid, created_ts, cari_title, kind, amount, due_date, note "
        "FROM collection_event ORDER BY created_ts DESC LIMIT ?",
        (min(limit, 500),))


def collections_summary(conn) -> dict:
    recovered = _one(conn,
        "SELECT SUM(amount) FROM collection_event "
        "WHERE kind IN ('tahsil','mahsup') AND amount IS NOT NULL")
    promised = _one(conn,
        "SELECT SUM(amount) FROM collection_event "
        "WHERE kind='soz' AND amount IS NOT NULL")
    by_kind = _rows(conn,
        "SELECT kind, COUNT(*) n, SUM(COALESCE(amount,0)) s "
        "FROM collection_event GROUP BY kind")
    return {"recovered": recovered, "promised": promised,
            "target": OKR_OLD_LEDGER_TARGET, "by_kind": by_kind,
            "kaynak": "Tahsilat defteri (journal → collection_event)"}


# ========================================================== cari / stok
def cari_list(conn, q: str | None = None, limit: int = 100) -> list[dict]:
    sql = ("SELECT ledger_code, title, debit, credit, balance, source_file "
           "FROM current_balance WHERE 1=1")
    params: list = []
    if q:
        sql += " AND title LIKE ?"
        params.append(f"%{q}%")
    sql += " ORDER BY ABS(COALESCE(balance,0)) DESC LIMIT ?"
    params.append(min(limit, 500))
    return _rows(conn, sql, params)


def cari_summary(conn) -> dict:
    row = conn.execute(
        "SELECT COUNT(*) n, SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) rec, "
        "SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END) pay, "
        "MAX(source_file) src FROM current_balance").fetchone()
    return {"n": row["n"], "receivable": row["rec"] or 0,
            "payable": row["pay"] or 0,
            "kaynak": row["src"] or "cari dosyası henüz bırakılmadı"}


def stock_list(conn, q: str | None = None, limit: int = 200) -> list[dict]:
    sql = ("SELECT code, name, unit, qty, unit_price, amount, source_file "
           "FROM stock_item WHERE 1=1")
    params: list = []
    if q:
        sql += " AND name LIKE ?"
        params.append(f"%{q}%")
    sql += " ORDER BY COALESCE(amount, qty*COALESCE(unit_price,0)) DESC LIMIT ?"
    params.append(min(limit, 500))
    return _rows(conn, sql, params)


def stock_summary(conn) -> dict:
    row = conn.execute(
        "SELECT COUNT(*) n, SUM(COALESCE(amount, qty*COALESCE(unit_price,0))) s, "
        "MAX(source_file) src FROM stock_item").fetchone()
    return {"n": row["n"], "amount": row["s"] or 0,
            "kaynak": row["src"] or "stok dosyası henüz bırakılmadı"}


# ================================================================== system
def system_status(conn) -> dict:
    runs = _rows(conn,
        "SELECT ran_at, source, status, rows_in, rows_loaded, note "
        "FROM ingest_run ORDER BY id DESC LIMIT 40")
    counts = {}
    for t in ("cash_entry", "old_balance", "payable_balance", "wa_message",
              "wa_signal", "order_record", "collection_event",
              "current_balance", "stock_item", "product", "kpi_definition",
              "event_log"):
        counts[t] = _one(conn, f"SELECT COUNT(*) FROM {t}")
    events = _rows(conn,
        "SELECT event_code, event_type, ts, actor FROM event_log "
        "ORDER BY id DESC LIMIT 15")
    return {"runs": runs, "table_counts": counts, "events": events}
