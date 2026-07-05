---
tip: n8n-workflow
kod: WF-01
surum: v1.0
tarih: 2026-07-05
sahip: Satış+Sistem
durum: onaylandi
---

# WF-01 — WhatsApp Sipariş Yakalama

**Tetikleyici:** "Mirfix sipariş" WhatsApp grubuna yeni mesaj (metin/ses).
**Girdi:** Serbest metin/ses → müşteri, ürün, marka, ambalaj, miktar, bölge.

## Adım Şeması
```mermaid
flowchart TD
  A[WhatsApp mesajı] --> B[Ses ise: transkript]
  B --> C[AI ayrıştırma: müşteri/ürün/marka/ambalaj/palet/bölge]
  C --> D{Müşteri tanındı mı?}
  D -- Hayır --> E[İnsana sor: yeni CAR mı?]
  D -- Evet --> F[SIP taslağı oluştur]
  F --> G[stok-risk-fiyat onay alanları = false]
  G --> H[İlgili role bildirim: onay bekliyor]
  H --> I{3 onay tamam mı?}
  I -- Evet --> J[SIP numarası ver + sayaç+1]
  I -- Hayır --> H
```

**AI Düğümü:** Ayrıştırma promptu (marka: MİRFİX/İzomir/Dimaxa/Bilfis; ambalaj: şirink/streç/zımba/torba/palet).
**İnsan Müdahale:** Belirsiz müşteri; fiyat onayı (FON — WF-11).
**Hata/Retry:** 3 deneme + insan bildirimi; ayrıştırılamayan mesaj → 00_INBOX'a düşer.
**Log:** `{mesaj_id, çıkarılan_alanlar, güven, sip_kod}`.
**Çıktı:** `42_Siparisler/SIP-*.md` taslağı. **İlgili:** SIP varlığı, Satış Agent. **KPI:** Otomatik yakalanan sipariş %.
