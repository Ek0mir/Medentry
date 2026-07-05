---
tip: dashboard
kod: MRF-OS-06-09
surum: v1.0
tarih: 2026-07-05
sahip: İK
durum: onaylandi
---

# 👥 İK Dashboard

> KVKK: Kişisel veri. Yalnızca yetkili erişir (B1.5).

## Aktif Personel
```dataview
TABLE rol, ise_giris, durum FROM #tip/personel
WHERE durum = "aktif" SORT rol ASC
```

## Açık Görev Yükü — Role Göre
```dataview
TABLE length(rows) AS "Açık Görev" FROM #tip/gorev
WHERE durum = "acik" OR durum = "devam"
GROUP BY atanan_rol SORT length(rows) DESC
```

## 🤖 AI Yorum (İK Agent 4.15)
> *Vardiya/görev yükü dengesi + devir/izin sinyalleri.*
