---
tip: dashboard
kod: MRF-OS-06-01
surum: v1.0
tarih: 2026-07-05
sahip: CEO
durum: onaylandi
---

# 🏢 CEO Dashboard — Şirket Nabzı

> 9 kart · Sabah brifingin (B8) görsel karşılığı · Eşik renkleri: 🟢🟡🔴

## Vadesi Geçen Alacaklar (Kart 4)
```dataview
TABLE musteri AS "Müşteri", tutar AS "Tutar", vade AS "Vade"
FROM #tip/tahsilat
WHERE durum != "tahsil" AND vade < date(today)
SORT tutar DESC
LIMIT 10
```

## Açık Siparişler (Kart 2)
```dataview
TABLE sum(rows.tutar) AS "Toplam Açık Sipariş"
FROM #tip/siparis
WHERE durum = "acik" OR durum = "onaylandi"
```

## Açık Şikâyetler (Kart 8)
```dataview
LIST FROM #tip/sikayet WHERE durum != "kapandi"
```

## 🤖 AI Yorum (CEO Agent 4.2)
> *Motor buraya "bugün 3 öncelik" cümlesini yazar (WF-13). Her iddia [[kanıt]] linkli.*

## Önerilen Kararlar
> *Durum-Kanıt-Seçenekler-Öneri-Gereken Onay (B8.3)*
