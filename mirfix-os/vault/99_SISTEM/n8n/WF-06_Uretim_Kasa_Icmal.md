---
tip: n8n-workflow
kod: WF-06
surum: v1.0
tarih: 2026-07-05
sahip: Üretim
durum: onaylandi
---

# WF-06 — Günlük Üretim & Kasa İcmal (Foto → Yapılandırılmış)

**Tetikleyici:** Günlük icmal fotoğrafı WhatsApp'a düşünce (mevcut akış).
**Girdi:** El yazısı/tablo fotoğrafı (üretim tonu, vardiya, kasa).

## Adım Şeması
```mermaid
flowchart TD
  A[İcmal fotoğrafı] --> B[OCR / AI görsel okuma]
  B --> C[Yapılandır: makine/vardiya/ton/duruş]
  C --> D[URE kaydı oluştur]
  D --> E{Ton < ortalama×0.8?}
  E -- Evet --> F[Tutarsızlık alarmı: "niye düştü?"]
  E -- Hayır --> G[Kaydı doğrula]
  F --> H[Üretim Agent yorumu]
```

**AI Düğümü:** Görsel→veri çıkarımı + Üretim Agent (4.8) tutarsızlık yorumu.
**İnsan Müdahale:** OCR düşük güvenli okuma → doğrulama.
**Retry:** Okunamayan foto → 00_INBOX + bildirim.
**Çıktı:** `61_Uretim/URE-*.md` + kasa kaydı. **KPI:** Ton/gün, veri doğruluk oranı.
