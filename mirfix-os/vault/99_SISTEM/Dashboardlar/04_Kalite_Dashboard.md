---
tip: dashboard
kod: MRF-OS-06-04
surum: v1.0
tarih: 2026-07-05
sahip: Kalite
durum: onaylandi
---

# ✅ Kalite Dashboard

## Açık Şikâyetler
```dataview
TABLE musteri, urun, konu, durum FROM #tip/sikayet
WHERE durum != "kapandi" SORT tarih ASC
```

## Ürün Bazlı Şikâyet (en çok)
```dataview
TABLE length(rows) AS "Adet" FROM #tip/sikayet
GROUP BY urun SORT length(rows) DESC
```

## Açık İadeler
```dataview
TABLE siparis, miktar, neden FROM #tip/iade
WHERE durum != "kabul" AND durum != "red"
```

## 🤖 AI Yorum (Kalite Agent 4.9)
> *Kök-neden paretosu + tekrar eden sorun uyarısı.*
