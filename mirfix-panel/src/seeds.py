"""Seed data.

PRODUCTS: transcribed from MRF-SAT-FYT v1 (05.07.2026). list_price=None
marks the workbook's '[FİYAT GİRİNİZ]' gaps so the panel can surface
them as publish blockers. Trade goods (MFX-TM-*) are day-priced.

KPI_DEFINITIONS: the core slice of the 30-KPI set in BOS §5.2 (targets
for 2026-H2 and the red thresholds).
"""
from __future__ import annotations

import sqlite3

GROUPS = {
    "SV": "Sıva Grubu",
    "YP": "Yapıştırıcı Grubu",
    "DZ": "Derz Dolgu Grubu",
    "YS": "Yüzey Sertleştirici Grubu",
    "SU": "Su Yalıtım Grubu",
    "AS": "Astar Grubu",
    "BY": "Boya Grubu",
    "TM": "Ticari Mallar",
}

# code, name, group, package, price (None => missing), note, trade_good
PRODUCTS = [
    ("MFX-SV-01", "Hazır Sıva — Gri (İç Cephe)", "SV", "25 kg", 115, None, 0),
    ("MFX-SV-02", "Hazır Sıva — Beyaz", "SV", "25 kg", 150, None, 0),
    ("MFX-SV-03", "Isı Yalıtım Levha Sıvası", "SV", "25 kg", 150, None, 0),
    ("MFX-SV-04", "Dekoratif Mineral Sıva", "SV", "25 kg", 180, None, 0),
    ("MFX-SV-05", "Süper Dekoratif Mineral Sıva", "SV", "25 kg", 190, None, 0),
    ("MFX-SV-06", "Tamir Harcı", "SV", "25 kg", 170, None, 0),
    ("MFX-YP-01", "Isı Yalıtım Levha Yapıştırıcısı (EPS/XPS)", "YP", "25 kg", 150, None, 0),
    ("MFX-YP-02", "Seramik ve Fayans Yapıştırıcısı", "YP", "25 kg", 150, None, 0),
    ("MFX-YP-03", "Gazbeton Yapıştırıcısı", "YP", "25 kg", 150, None, 0),
    ("MFX-YP-04", "Bims ve Tuğla Yapıştırıcısı", "YP", "25 kg", 150, None, 0),
    ("MFX-YP-05", "Flex Granit ve Doğal Taş Yapıştırıcısı — Gri", "YP", "25 kg", 200, None, 0),
    ("MFX-YP-06", "Flex Granit ve Doğal Taş Yapıştırıcısı — Beyaz", "YP", "25 kg", 250, None, 0),
    ("MFX-DZ-01", "Derz Dolgu — Beyaz", "DZ", "20 kg", 350, None, 0),
    ("MFX-DZ-02", "Derz Dolgu — Gri", "DZ", "20 kg", 350, None, 0),
    ("MFX-DZ-03", "Derz Dolgu — Bej", "DZ", "20 kg", 350, None, 0),
    ("MFX-YS-01", "Yüzey Sertleştirici — Gri", "YS", "25 kg", 225, None, 0),
    ("MFX-YS-02", "Yüzey Sertleştirici — Kırmızı", "YS", "25 kg", 275, None, 0),
    ("MFX-YS-03", "Yüzey Sertleştirici — Süper Kırmızı", "YS", "25 kg", 300, None, 0),
    ("MFX-SU-01", "İzolatex Çift Komponent — Tam Elastik (Takım)", "SU", "20+6 kg", 1400,
     "Sahada 1.500 ₺'den satış örneği var — güncel maliyetle kontrol", 0),
    ("MFX-SU-02", "İzolatex Çift Komponent — Yarı Elastik (Takım)", "SU", "20+6 kg", 1200, None, 0),
    ("MFX-SU-03", "Kristalize Toz Membran", "SU", "?? kg", 500, "Ambalaj kg'ı doldurulacak", 0),
    ("MFX-AS-01", "Brüt Beton ve Alçı Sıva Astarı", "AS", "12 kg", 450, None, 0),
    ("MFX-AS-02", "Brüt Beton ve Alçı Sıva Astarı", "AS", "5 kg", None, "[FİYAT GİRİNİZ]", 0),
    ("MFX-AS-03", "Brüt Beton ve Alçı Sıva Astarı", "AS", "2 kg", None, "[FİYAT GİRİNİZ]", 0),
    ("MFX-BY-01", "Tavan Boyası", "BY", "17 kg", None, "[FİYAT GİRİNİZ]", 0),
    ("MFX-TM-01", "Saten Perdah Alçısı", "TM", "?? kg", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-02", "Sıva Alçısı", "TM", "?? kg", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-03", "Sönmüş Kireç", "TM", "?? kg", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-04", "Çimento 32.5", "TM", "Torba", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-05", "Sıva Filesi", "TM", "Top", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-06", "Mantolama Dübeli", "TM", "Adet/Koli", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-07", "XPS / EPS Isı Yalıtım Levhası", "TM", "m²/Paket", None, "Günlük fiyat — sorunuz", 1),
    ("MFX-TM-08", "Alçı Köşe Profili", "TM", "Adet", None, "Günlük fiyat — sorunuz", 1),
]

# code, name, dept, unit, target, red, direction, source
KPI_DEFINITIONS = [
    ("KPI-D2-YAKALAMA", "Sipariş yakalama oranı", "D2 Satış", "%", 90, 70, "up", "BOS §5.2 — numaralı SIP / kanal siparişi"),
    ("KPI-D2-DONUSUM", "Teklif → sipariş dönüşümü", "D2 Satış", "%", 40, 25, "up", "BOS §5.2"),
    ("KPI-D2-TEYITSIZ", "Teyitsiz termin vakası", "D2 Satış", "adet/ay", 0, 2, "down", "BOS §5.2"),
    ("KPI-D3-URETIM", "Üretim (torba/gün ort.)", "D3 Üretim", "torba", 2700, 2200, "up", "BOS §5.2 — ICM"),
    ("KPI-D4-HATALI-SEVK", "Hatalı sevkiyat", "D4 Lojistik", "adet", 0, 1, "down", "BOS §5.2"),
    ("KPI-D4-PALET", "Palet dönüş oranı (30g)", "D4 Lojistik", "%", 90, 70, "up", "BOS §5.2"),
    ("KPI-D5-DSO", "DSO (ticari)", "D5 Finans", "gün", 30, 45, "down", "BOS §5.2 — yaşlandırma"),
    ("KPI-D5-120PLUS", "120+ gün alacak stoku", "D5 Finans", "₺", 3_000_000, 7_500_000, "down", "BOS §5.2 — 7,5M→<3M hedefi"),
    ("KPI-D5-SOZ", "Söz-tutma oranı", "D5 Finans", "%", 80, 60, "up", "BOS §5.2"),
    ("KPI-D5-ESKIKASA", "Eski-kasa kurtarımı", "D5 Finans", "₺/ay", 4_000_000, 1_000_000, "up", "BOS §5.2 — SRC-10"),
    ("KPI-D5-IADECEK", "İade çek", "D5 Finans", "adet/ay", 0, 2, "down", "BOS §5.2"),
    ("KPI-D6-ICERIK", "İçerik yayını", "D6 Pazarlama", "adet/hafta", 6, 0, "up", "BOS §5.2"),
    ("KPI-D1-INBOX", "INBOX ≤24s kayıt uyumu", "D1 GM", "%", 95, 80, "up", "BOS §5.2"),
    ("KPI-D1-KARAR", "Karar SLA uyumu", "D1 GM", "%", 90, 70, "up", "BOS §5.2"),
]


def seed(conn: sqlite3.Connection) -> dict:
    conn.executemany(
        "INSERT INTO product(code, name, group_code, group_name, package_info, "
        "list_price, price_note, is_trade_good) VALUES (?,?,?,?,?,?,?,?)",
        [(c, n, g, GROUPS[g], p, price, note, tg)
         for c, n, g, p, price, note, tg in PRODUCTS],
    )
    conn.executemany(
        "INSERT INTO kpi_definition(code, name, department, unit, target_value, "
        "red_value, direction, source_note) VALUES (?,?,?,?,?,?,?,?)",
        KPI_DEFINITIONS,
    )
    conn.commit()
    return {"products": len(PRODUCTS), "kpi_definitions": len(KPI_DEFINITIONS)}
