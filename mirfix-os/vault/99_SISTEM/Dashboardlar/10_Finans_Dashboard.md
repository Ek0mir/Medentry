---
tip: dashboard
kod: MRF-OS-06-10
surum: v1.0
tarih: 2026-07-05
sahip: Finans
durum: onaylandi
---

# 🏦 Finans Dashboard — Nakit Köprüsü

## Bu Hafta Tahsil Edilenler
```dataview
TABLE musteri, tutar, kanal FROM #tip/tahsilat
WHERE durum = "tahsil" AND tarih >= date(today) - dur(7 days)
```

## Yaklaşan Çek Vadeleri (30 gün)
```dataview
TABLE musteri, tutar, vade FROM #tip/tahsilat
WHERE kanal = "çek" AND durum != "tahsil" AND vade <= date(today) + dur(30 days)
SORT vade ASC
```

## Mutabakat — Yanıt Bekleyenler
```dataview
LIST FROM "50_FINANS/53_Mutabakat"
WHERE durum = "gonderildi"
```

## 🤖 AI Yorum (Finans Agent 4.6)
> *Nakit köprüsü (açılış→tahsilat→ödeme→kapanış) + 4 haftalık projeksiyon + sıkışma uyarısı.*
