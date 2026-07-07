"""HTTP surface of the panel.

API-Bible alignment (scaled to a local tool): path-versioned /api/v1,
every response echoes a trace id (X-Iz-Id), commands vs queries are
separate, and no endpoint executes anything gate-worthy — the panel
reads and proposes, humans decide.
"""
from __future__ import annotations

import asyncio
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import (FileResponse, JSONResponse, PlainTextResponse,
                               StreamingResponse)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import analytics, obsidian, wa_gateway
from .config import (WEB_DIR, DB_PATH, APP_NAME, APP_CODE, APP_VERSION,
                     WA_VERIFY_TOKEN, WA_BRIDGE_TOKEN, WATCH_SECONDS,
                     load_settings, save_settings)
from .database import get_conn, log_event
from .etl.pipeline import run_all, source_dirs
from .journal import append_event, apply_event
from .wa_gateway import broker

app = FastAPI(title=APP_NAME, version=APP_VERSION)

_retrain_lock = threading.Lock()


def _retrain() -> dict:
    """Serialized full re-ingest; also notifies open panels over SSE."""
    with _retrain_lock:
        summary = run_all()
    broker.publish({"tip": "yeniden_egitim", "bitis": summary["finished"]})
    return summary


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Iz-Id") or f"IZ-{uuid.uuid4().hex[:12]}"
    response = await call_next(request)
    response.headers["X-Iz-Id"] = trace_id
    return response


def _with_conn(fn, *args, **kwargs):
    conn = get_conn()
    try:
        return fn(conn, *args, **kwargs)
    finally:
        conn.close()


# ------------------------------------------------------------ queries (v1)
@app.get("/api/v1/saglik")
def health():
    return {"durum": "ayakta", "uygulama": APP_CODE, "surum": APP_VERSION,
            "veritabani": DB_PATH.exists()}


@app.get("/api/v1/ozet")
def get_overview():
    return _with_conn(analytics.overview)


@app.get("/api/v1/kasa/aylik")
def get_cash_monthly():
    return {"veri": _with_conn(analytics.cash_monthly)}


@app.get("/api/v1/kasa/kategoriler")
def get_cash_categories():
    return {"veri": _with_conn(analytics.cash_categories)}


@app.get("/api/v1/kasa/cariler")
def get_cash_counterparties(yon: str = Query("out", pattern="^(in|out)$"),
                            limit: int = Query(20, ge=1, le=100)):
    return {"veri": _with_conn(analytics.cash_counterparties, yon, limit)}


@app.get("/api/v1/kasa/hareketler")
def get_cash_entries(q: str | None = None, kategori: str | None = None,
                     limit: int = Query(100, ge=1, le=500)):
    return {"veri": _with_conn(analytics.cash_entries, q, kategori, limit)}


@app.get("/api/v1/uyum")
def get_compliance():
    return _with_conn(analytics.compliance)


@app.get("/api/v1/eski-kasa/ozet")
def get_old_ledger_summary():
    return _with_conn(analytics.old_ledger_summary)


@app.get("/api/v1/eski-kasa/liste")
def get_old_ledger_top(sinif: str | None = None,
                       limit: int = Query(25, ge=1, le=200)):
    return {"veri": _with_conn(analytics.old_ledger_top, sinif, limit)}


@app.get("/api/v1/eski-kasa/mahsup")
def get_mahsup():
    return {"veri": _with_conn(analytics.mahsup_opportunities)}


@app.get("/api/v1/wa/ozet")
def get_wa_summary():
    return _with_conn(analytics.wa_summary)


@app.get("/api/v1/wa/sinyaller")
def get_wa_signals(tip: str = Query("order"),
                   limit: int = Query(40, ge=1, le=200)):
    return {"veri": _with_conn(analytics.wa_signals, tip, limit)}


@app.get("/api/v1/urunler")
def get_products():
    return _with_conn(analytics.products)


@app.get("/api/v1/kpi")
def get_kpis():
    return {"veri": _with_conn(analytics.kpis)}


@app.get("/api/v1/sistem")
def get_system():
    return _with_conn(analytics.system_status)


# ------------------------------------------------------------ orders
class OrderIn(BaseModel):
    musteri: str | None = None
    urunler: str | None = None
    palet: float | None = None
    torba: float | None = None
    tutar: float | None = None
    not_: str | None = Field(None, alias="not")
    kaynak: str = "manuel"
    wa_msg_uid: str | None = None

    model_config = {"populate_by_name": True}


class OrderStatusIn(BaseModel):
    durum: str = Field(pattern="^(yeni|hazirlaniyor|sevk|kapandi|iptal)$")


@app.get("/api/v1/siparisler")
def get_orders(durum: str | None = None, limit: int = Query(100, ge=1, le=500)):
    return {"veri": _with_conn(analytics.orders_list, durum, limit),
            "ozet": _with_conn(analytics.orders_summary)}


@app.post("/api/v1/siparisler")
def create_order(body: OrderIn):
    """Journal-first write: the order is appended to events.jsonl, then
    applied to the read model — a retrain can never lose it."""
    record = append_event("order", {
        "customer": body.musteri, "items": body.urunler,
        "qty_pallet": body.palet, "qty_bag": body.torba,
        "amount": body.tutar, "note": body.not_,
        "source": body.kaynak, "wa_msg_uid": body.wa_msg_uid, "status": "yeni"})
    conn = get_conn()
    try:
        apply_event(conn, record)
        conn.commit()
        log_event(conn, "SIPARIS.olusturuldu",
                  {"uid": record["uid"], "kaynak": body.kaynak}, actor="user:panel")
    finally:
        conn.close()
    broker.publish({"tip": "siparis_kaydi", "uid": record["uid"]})
    return {"durum": "kaydedildi", "siparis_uid": record["uid"]}


@app.post("/api/v1/siparisler/{order_uid}/durum")
def update_order_status(order_uid: str, body: OrderStatusIn):
    record = append_event("order_status",
                          {"order_uid": order_uid, "status": body.durum})
    conn = get_conn()
    try:
        apply_event(conn, record)
        conn.commit()
    finally:
        conn.close()
    return {"durum": "guncellendi", "siparis_uid": order_uid, "yeni_durum": body.durum}


@app.get("/api/v1/siparisler/oneriler")
def get_order_suggestions(limit: int = Query(30, ge=1, le=100)):
    return {"veri": _with_conn(wa_gateway.order_suggestions, limit)}


@app.post("/api/v1/siparisler/oneriler/{msg_uid}/yoksay")
def dismiss_suggestion(msg_uid: str):
    record = append_event("wa_dismiss", {"msg_uid": msg_uid})
    conn = get_conn()
    try:
        apply_event(conn, record)
        conn.commit()
    finally:
        conn.close()
    return {"durum": "yoksayildi", "msg_uid": msg_uid}


# ------------------------------------------------------------ collections
class CollectionIn(BaseModel):
    cari: str
    tur: str = Field(pattern="^(soz|tahsil|mahsup)$")
    tutar: float | None = None
    vade: str | None = None
    not_: str | None = Field(None, alias="not")

    model_config = {"populate_by_name": True}


@app.get("/api/v1/tahsilat")
def get_collections(limit: int = Query(100, ge=1, le=500)):
    return {"veri": _with_conn(analytics.collections_list, limit),
            "ozet": _with_conn(analytics.collections_summary)}


@app.post("/api/v1/tahsilat")
def create_collection(body: CollectionIn):
    record = append_event("collection", {
        "cari_title": body.cari, "collection_kind": body.tur,
        "amount": body.tutar, "due_date": body.vade, "note": body.not_})
    conn = get_conn()
    try:
        apply_event(conn, record)
        conn.commit()
        log_event(conn, "TAHSILAT.kaydedildi",
                  {"uid": record["uid"], "tur": body.tur}, actor="user:panel")
    finally:
        conn.close()
    return {"durum": "kaydedildi", "kayit_uid": record["uid"]}


# ------------------------------------------------------------ cari / stok
@app.get("/api/v1/cari/liste")
def get_cari(q: str | None = None, limit: int = Query(100, ge=1, le=500)):
    return {"veri": _with_conn(analytics.cari_list, q, limit),
            "ozet": _with_conn(analytics.cari_summary)}


@app.get("/api/v1/stok/liste")
def get_stock(q: str | None = None, limit: int = Query(200, ge=1, le=500)):
    return {"veri": _with_conn(analytics.stock_list, q, limit),
            "ozet": _with_conn(analytics.stock_summary)}


# ------------------------------------------------------------ obsidian
class VaultIn(BaseModel):
    yol: str


@app.get("/api/v1/obsidian/durum")
def get_vault_status():
    return obsidian.vault_status()


@app.post("/api/v1/ayarlar/vault")
def set_vault(body: VaultIn):
    p = Path(body.yol).expanduser()
    if not p.is_dir():
        raise HTTPException(400, f"Klasör bulunamadı: {p}")
    settings = load_settings()
    settings["vault_path"] = str(p)
    save_settings(settings)
    obsidian.vault_dirs(create=True)
    return {"durum": "kaydedildi", "vault": str(p),
            "not_": "Bir sonraki eğitim turunda MIRFIX/Gelen taranır, "
                    "MIRFIX/Panel raporları yazılır."}


@app.post("/api/v1/komutlar/vault-yaz")
def write_vault():
    conn = get_conn()
    try:
        r = obsidian.export_reports(conn)
    finally:
        conn.close()
    if r["status"] != "ok":
        return JSONResponse(status_code=400, content={"durum": "hata", "detay": r["note"]})
    return {"durum": "yazildi", "detay": r["note"]}


# --------------------------------------------------- live WhatsApp agent
@app.get("/api/v1/wa/webhook")
def wa_webhook_verify(request: Request):
    """Meta Cloud API verification handshake."""
    qp = request.query_params
    if qp.get("hub.mode") == "subscribe" and \
            qp.get("hub.verify_token") == WA_VERIFY_TOKEN:
        return PlainTextResponse(qp.get("hub.challenge", ""))
    raise HTTPException(403, "verify token uyuşmadı")


@app.post("/api/v1/wa/webhook")
async def wa_webhook(request: Request):
    body = await request.json()
    results = [wa_gateway.receive_message(**m)
               for m in wa_gateway.parse_meta_webhook(body)]
    return {"durum": "alindi", "mesaj": len(results)}


class WaInbound(BaseModel):
    grup: str | None = None
    gonderen: str | None = None
    metin: str = ""
    zaman: str | None = None
    medya: bool = False


@app.post("/api/v1/wa/gelen")
def wa_bridge(body: WaInbound,
              x_mirfix_anahtar: str | None = Header(None)):
    """Generic bridge for any local forwarder (whatsapp-web.js, n8n...)."""
    if WA_BRIDGE_TOKEN and x_mirfix_anahtar != WA_BRIDGE_TOKEN:
        raise HTTPException(401, "X-Mirfix-Anahtar gerekli")
    r = wa_gateway.receive_message(body.grup, body.gonderen, body.metin,
                                   body.zaman, body.medya)
    return {"durum": "alindi", **r}


@app.get("/api/v1/wa/canli")
async def wa_live():
    """SSE stream: order signals + retrain notifications, as they happen."""
    q = broker.attach()
    return StreamingResponse(wa_gateway.sse_stream(q),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


# ------------------------------------------------------------ command (v1)
@app.post("/api/v1/komutlar/yeniden-egit")
def retrain():
    """Re-run the full ingest pipeline over data/raw + vault inbox
    (self-training). Read-model rebuild only — no gate-scope action, so
    no approval flow is required (MRF-OS-001 §1.4.3 untouched)."""
    try:
        summary = _retrain()
        return {"durum": "tamamlandi", "ozet": summary}
    except Exception as exc:                             # noqa: BLE001
        return JSONResponse(status_code=500,
                            content={"durum": "hata", "detay": str(exc)})


# --------------------------------------------------------- file watcher
def _sources_snapshot() -> dict:
    snap = {}
    for d in source_dirs():
        if d.is_dir():
            for p in d.iterdir():
                if p.is_file():
                    snap[str(p)] = p.stat().st_mtime
    return snap


async def _watch_sources() -> None:
    last = _sources_snapshot()
    while True:
        await asyncio.sleep(WATCH_SECONDS)
        try:
            snap = _sources_snapshot()
            if snap != last and not _retrain_lock.locked():
                last = snap
                await asyncio.to_thread(_retrain)
            else:
                last = snap
        except Exception:                                # noqa: BLE001
            pass                     # watcher must never die


@app.on_event("startup")
async def _startup() -> None:
    broker.loop = asyncio.get_running_loop()
    asyncio.create_task(_watch_sources())


# ------------------------------------------------------------------ static
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")
