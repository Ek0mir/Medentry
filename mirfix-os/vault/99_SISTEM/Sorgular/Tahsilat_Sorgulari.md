---
tip: sistem/sorgu
kod: MRF-OS-SORGU-TAH
surum: v1.0
tarih: 2026-07-05
sahip: Finans
---

# Dataview Sorgu Kütüphanesi — Tahsilat & Finans

## 1) Bugün Aranacaklar — Vadesi Geçenler
```dataview
TABLE musteri AS "Müşteri", tutar AS "Tutar", vade AS "Vade"
FROM #tip/tahsilat
WHERE durum != "tahsil" AND vade <= date(today)
SORT vade ASC
```

## 2) Yaklaşan Vadeler (7 gün)
```dataview
TABLE musteri, tutar, vade
FROM #tip/tahsilat
WHERE durum = "bekliyor" AND vade > date(today) AND vade <= date(today) + dur(7 days)
SORT vade ASC
```

## 3) Tutulmayan Ödeme Sözleri
```dataview
TABLE musteri, soz_tutari, soz_tarihi
FROM #tip/tahsilat
WHERE tutuldu_mu = "hayir"
SORT soz_tarihi ASC
```

## 4) Riskli Sınıf + Bakiyeli Müşteriler
```dataview
TABLE risk_sinifi, limit, vade_gun
FROM #tip/musteri
WHERE contains(list("F","G","H"), risk_sinifi)
SORT risk_sinifi DESC
```

## 5) Çek Portföyü — Vade Dağılımı
```dataview
TABLE musteri, tutar, vade
FROM #tip/tahsilat
WHERE kanal = "çek" AND durum != "tahsil"
SORT vade ASC
```

## 6) Bu Hafta Tahsil Edilenler
```dataview
TABLE musteri, tutar, kanal
FROM #tip/tahsilat
WHERE durum = "tahsil" AND tarih >= date(today) - dur(7 days)
```
