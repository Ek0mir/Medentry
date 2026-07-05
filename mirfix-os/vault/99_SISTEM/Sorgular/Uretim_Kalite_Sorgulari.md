---
tip: sistem/sorgu
kod: MRF-OS-SORGU-URT
surum: v1.0
tarih: 2026-07-05
sahip: Üretim/Kalite
---

# Dataview Sorgu Kütüphanesi — Üretim & Kalite

## 15) Son 7 Gün Üretim (ton)
```dataview
TABLE urun, ton, durus_nedeni
FROM #tip/uretim
WHERE tarih >= date(today) - dur(7 days)
SORT tarih DESC
```

## 16) Duruş Nedenleri Dağılımı (bu ay)
```dataview
TABLE rows.ton AS "Kayıtlar", sum(rows.durus_dakika) AS "Toplam Duruş dk"
FROM #tip/uretim
WHERE durus_nedeni AND tarih >= date(today) - dur(30 days)
GROUP BY durus_nedeni
```

## 17) Açık Şikâyetler
```dataview
TABLE musteri, urun, konu, durum
FROM #tip/sikayet
WHERE durum != "kapandi"
SORT tarih ASC
```

## 18) Ürün Bazlı Şikâyet Sayısı (en çok şikâyet)
```dataview
TABLE length(rows) AS "Şikâyet Sayısı"
FROM #tip/sikayet
GROUP BY urun
SORT length(rows) DESC
```

## 19) Açık İadeler
```dataview
TABLE siparis, miktar, neden, durum
FROM #tip/iade
WHERE durum != "kabul" AND durum != "red"
```

## 20) Tekrar Eden Şikâyet (aynı ürün ≥3)
```dataview
TABLE length(rows) AS "Adet"
FROM #tip/sikayet
WHERE tarih >= date(today) - dur(30 days)
GROUP BY urun
WHERE length(rows) >= 3
```
