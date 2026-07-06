---
tip: n8n-workflow
kod: WF-11
surum: v1.0
tarih: 2026-07-05
sahip: Satış/CEO
durum: onaylandi
---

# WF-11 — Onay Akışı (FON: Fiyat Onayı → WhatsApp Buton)

**Tetikleyici:** Fiyat/limit/sevkiyat/iade kararı gerektiren durum (9 kapıdan biri, B1.4).
**Girdi:** Karar bağlamı + öneri (agent'tan).

## Adım Şeması
```mermaid
flowchart TD
  A[Onay gereken durum] --> B[Bağlam + öneri hazırla]
  B --> C[Yetkiliye WhatsApp buton mesajı: Onayla / Reddet / Değiştir]
  C --> D{Yanıt}
  D -- Onayla --> E[İlgili alanı true yap + logla]
  D -- Reddet --> F[Gerekçe iste + kaydet]
  D -- Değiştir --> G[Yeni değer al → tekrar onaya]
```

**İnsan Müdahale:** ÇEKİRDEK — bu WF'in tamamı insan onayıdır.
**Log:** `{kapı, öneren_agent, karar, onaylayan, zaman}` — kararların karnesine (B8.5) besler.
**Çıktı:** Onay damgalı karar. **KPI:** Onay süresi, red oranı.
