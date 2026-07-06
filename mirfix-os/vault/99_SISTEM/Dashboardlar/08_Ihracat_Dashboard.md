---
tip: dashboard
kod: MRF-OS-06-08
surum: v1.0
tarih: 2026-07-05
sahip: İhracat
durum: onaylandi
---

# 🌍 İhracat Dashboard

> Faz 3 (25-36 ay — B9.4). İskelet hazır.

## Açık İhracat Fırsatları
```dataview
TABLE musteri, tip, durum FROM #tip/proje
WHERE contains(etiketler, "ihracat") AND durum != "kapandi"
```

## 🤖 AI Yorum (İhracat Agent 4.12)
> *Ülke kırılımı, belge tamamlanma (proforma/ETGB/menşe), döviz pozisyonu.*
