---
tip: dashboard
kod: MRF-OS-06-07
surum: v1.0
tarih: 2026-07-05
sahip: Pazarlama
durum: onaylandi
---

# 📣 Pazarlama Dashboard

## İçerik Takvimi — Yayınlanacaklar
```dataview
TABLE durum, kanallar FROM #tip/icerik
WHERE durum != "yayinlandi" SORT tarih ASC
```

## Yayınlanan İçerikler (bu ay)
```dataview
LIST FROM #tip/icerik
WHERE durum = "yayinlandi" AND tarih >= date(today) - dur(30 days)
```

## 🤖 AI Yorum (Pazarlama Agent 4.10)
> *İçerik→talep hunisi: atom→erişim→gelen soru→teklif dönüşümü.*
