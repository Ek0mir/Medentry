---
tip: n8n-workflow
kod: WF-07
surum: v1.0
tarih: 2026-07-05
sahip: Depo-Sevkiyat
durum: onaylandi
---

# WF-07 — Sevkiyat Bildirimi + Palet İade Sayacı

**Tetikleyici:** "Araç çıktı" mesajı / SVK durumu=yolda.
**Girdi:** SVK (plaka, şoför, sipariş, palet).

## Adım Şeması
1. SIP 3 onay kontrolü (stok-risk-fiyat) → eksikse blokla
2. Müşteriye "aracınız yolda" bildirimi
3. Teslim teyidi al → SVK durumu=teslim
4. Palet: gönderilen − iade → müşteride bekleyen sayaç güncelle
5. Termin aşıldı → uyarı-21; palet birikti → uyarı-22

**İnsan Müdahale:** Onaysız sipariş sevk edilemez (Kapı-3).
**Retry:** Teslim teyidi gelmezse hatırlatma.
**Çıktı:** Güncel SVK + palet sayacı. **KPI:** Zamanında teslim %, bekleyen palet.
