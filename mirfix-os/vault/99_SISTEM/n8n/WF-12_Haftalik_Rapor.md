---
tip: n8n-workflow
kod: WF-12
surum: v1.0
tarih: 2026-07-05
sahip: CEO
durum: onaylandi
---

# WF-12 — Haftalık Yönetim Raporu

**Tetikleyici:** Cuma 17:00 cron.
**Girdi:** Haftanın KPI'ları (6 panel), açık kararlar, sonuç ölçümleri.

## Adım Şeması
1. Toplayıcılar: satış/tahsilat/üretim/kalite/finans haftalık özet
2. Her agent kendi bölümünü yazar (kanıtlı)
3. CEO Agent sentezler → tek rapor
4. Karar→görev→sonuç kapalı döngü karnesi (B8.5) eklenir
5. Teslim: vault notu + WhatsApp özeti

**İnsan Müdahale:** Yok (rapor); kararlar ayrı onaydan geçer.
**Çıktı:** `10_SIRKET/13_Kararlar/haftalik-rapor-*.md`. **KPI:** Rapor isabet, aksiyon oranı.
