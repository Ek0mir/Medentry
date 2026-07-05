---
tip: dashboard
kod: MRF-OS-06-03
surum: v1.0
tarih: 2026-07-05
sahip: Üretim
durum: onaylandi
---

# 🏭 Üretim Dashboard

## Son 7 Gün Ton
```dataview
TABLE urun, ton, durus_nedeni FROM #tip/uretim
WHERE tarih >= date(today) - dur(7 days) SORT tarih DESC
```

## Duruş Nedenleri Pareto (bu ay)
```dataview
TABLE sum(rows.durus_dakika) AS "Toplam Duruş dk"
FROM #tip/uretim
WHERE durus_nedeni AND tarih >= date(today) - dur(30 days)
GROUP BY durus_nedeni SORT sum(rows.durus_dakika) DESC
```

## 🤖 AI Yorum (Üretim Agent 4.8)
> *"Dün ton düştü, %60'ı elektrik; jeneratör bakımı gündeme al."*
