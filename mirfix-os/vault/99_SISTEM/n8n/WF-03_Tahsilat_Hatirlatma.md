---
tip: n8n-workflow
kod: WF-03
surum: v1.0
tarih: 2026-07-05
sahip: Finans
durum: onaylandi
---

# WF-03 — Tahsilat Hatırlatma (Vade Kademeleri)

**Tetikleyici:** Günlük 09:00 cron — açık THS taraması.
**Girdi:** THS (tutar, vade, kanal, müşteri risk sınıfı).

## Kademeler
```mermaid
flowchart LR
  V7[Vade -7: nazik] --> V0[Vade 0: gün geldi]
  V0 --> P7[+7: resmi hatırlatma]
  P7 --> P14[+14: telefon + söz iste]
  P14 --> P30[+30: eskalasyon]
  P30 --> BLOK{Sevkiyat blokaj?}
  BLOK -->|CEO/Finans onayı| B[Kapı-3]
```

**AI Düğümü:** Tahsilat Agent (4.5) — müşteri risk + söz-tutma geçmişine göre ton/kademe.
**İnsan Müdahale:** +30 eskalasyon ve sevkiyat blokajı (Kapı-3).
**Retry:** Mesaj gitmezse 3 deneme + bildirim.
**Çıktı:** Hatırlatma mesajları + THS durum güncel + ödeme sözü kaydı. **KPI:** DSO, söz-tutma oranı.
