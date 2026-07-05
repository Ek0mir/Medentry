---
tip: sistem/sorgu
kod: MRF-OS-SORGU-SAT
surum: v1.0
tarih: 2026-07-05
sahip: Satış
---

# Dataview Sorgu Kütüphanesi — Satış & CRM

## 7) Açık Siparişler — Termine Göre
```dataview
TABLE musteri, tutar, termin, stok_teyit
FROM #tip/siparis
WHERE durum = "acik" OR durum = "onaylandi"
SORT termin ASC
```

## 8) Fiyat Onayı Bekleyen Siparişler (>24 saat)
```dataview
TABLE musteri, tutar, tarih
FROM #tip/siparis
WHERE onay_fiyat = false AND tarih <= date(today) - dur(1 days)
```

## 9) Stok Teyidi Bekleyen Siparişler
```dataview
TABLE musteri, termin
FROM #tip/siparis
WHERE stok_teyit = "bekliyor"
SORT termin ASC
```

## 10) Bu Hafta Ziyaret Edilmeyen A-Sınıfı Müşteriler
```dataview
TABLE risk_sinifi, bolge, son_ziyaret
FROM #tip/musteri
WHERE risk_sinifi = "A" AND (son_ziyaret < date(today) - dur(7 days) OR !son_ziyaret)
SORT son_ziyaret ASC
```

## 11) Uyuyan Müşteriler (60 gün sipariş yok)
```dataview
TABLE bolge, son_siparis
FROM #tip/musteri
WHERE durum = "aktif" AND son_siparis < date(today) - dur(60 days)
SORT son_siparis ASC
```

## 12) Bu Ay Kaybedilen Teklifler + Neden
```dataview
TABLE musteri, toplam, kayip_nedeni
FROM #tip/teklif
WHERE durum = "kaybedildi" AND tarih >= date(today) - dur(30 days)
```

## 13) Bekleyen Numuneler (15 gün kuralı)
```dataview
TABLE musteri, tarih
FROM #tip/ziyaret
WHERE numune_verildi = true AND takip_yapildi != true AND tarih <= date(today) - dur(15 days)
```

## 14) Açık Teklifler — Takip Zamanı Gelenler
```dataview
TABLE musteri, toplam, gecerlilik
FROM #tip/teklif
WHERE durum = "gonderildi"
SORT gecerlilik ASC
```
