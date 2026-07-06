---
tip: n8n-workflow
kod: WF-04
surum: v1.0
tarih: 2026-07-05
sahip: Finans
durum: onaylandi
---

# WF-04 — Mutabakat Gönderimi (241 Form Otomasyonu)

**Tetikleyici:** Aylık cron (ayın 1'i) — mevcut 241 formluk mutabakat sisteminin otomasyonu.
**Girdi:** Cari bakiyeler (THS/FAT), müşteri iletişim.

## Adım Şeması
1. Her cari için mutabakat mektubu üret (bakiye + hareket özeti)
2. Toplu gönder (e-posta/WhatsApp) → `53_Mutabakat/` kaydı
3. Yanıt takibi: 15 gün yanıtsız → hatırlatma (uyarı-23)
4. Uyuşmazlık → Finans'a görev (fark analizi)

**AI Düğümü:** Yanıt metinlerini "mutabık / itiraz / yanıtsız" sınıfla.
**İnsan Müdahale:** İtiraz durumunda fark çözümü.
**Retry:** Gönderim 3 deneme.
**Çıktı:** 241 mutabakat kaydı + yanıt durumu. **KPI:** Mutabakat yanıt oranı, uyuşmazlık sayısı.
