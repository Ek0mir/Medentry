---
tip: dashboard
kod: MRF-OS-06-05
surum: v1.0
tarih: 2026-07-05
sahip: Finans
durum: onaylandi
---

# 💰 Tahsilat Dashboard

## Vadesi Geçenler — Top 10
```dataview
TABLE musteri, tutar, vade FROM #tip/tahsilat
WHERE durum != "tahsil" AND vade < date(today)
SORT tutar DESC LIMIT 10
```

## Tutulmayan Ödeme Sözleri
```dataview
TABLE musteri, soz_tutari, soz_tarihi FROM #tip/tahsilat
WHERE tutuldu_mu = "hayir" SORT soz_tarihi ASC
```

## Çek Portföyü
```dataview
TABLE musteri, tutar, vade FROM #tip/tahsilat
WHERE kanal = "çek" AND durum != "tahsil" SORT vade ASC
```

## 🤖 AI Yorum (Tahsilat Agent 4.5)
> *DSO trendi + eskalasyon önerileri (risk sınıfı + söz-tutma).*
