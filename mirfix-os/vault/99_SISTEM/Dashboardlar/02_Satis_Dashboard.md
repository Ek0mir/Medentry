---
tip: dashboard
kod: MRF-OS-06-02
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# 📈 Satış Dashboard

## Açık Teklifler (takip zamanı)
```dataview
TABLE musteri, toplam, gecerlilik FROM #tip/teklif
WHERE durum = "gonderildi" SORT gecerlilik ASC
```

## Bu Ay Kaybedilen — Neden
```dataview
TABLE musteri, toplam, kayip_nedeni FROM #tip/teklif
WHERE durum = "kaybedildi" AND tarih >= date(today) - dur(30 days)
```

## Açık Siparişler — Termine Göre
```dataview
TABLE musteri, tutar, termin FROM #tip/siparis
WHERE durum = "acik" SORT termin ASC
```

## 🤖 AI Yorum (Satış Agent 4.3)
> *"Bugün ara" listesi + dönüşüm yorumu.*
