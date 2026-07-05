---
tip: dashboard
kod: MRF-OS-06-06
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# 🤝 CRM Dashboard

## Uyuyan Müşteriler (60 gün sipariş yok)
```dataview
TABLE bolge, son_siparis FROM #tip/musteri
WHERE durum = "aktif" AND son_siparis < date(today) - dur(60 days)
SORT son_siparis ASC
```

## Ziyaretsiz A-Sınıfı (21 gün)
```dataview
TABLE bolge, son_ziyaret FROM #tip/musteri
WHERE risk_sinifi = "A" AND (son_ziyaret < date(today) - dur(21 days) OR !son_ziyaret)
```

## 🤖 AI Yorum (CRM Agent 4.4)
> *İlişkisi zayıflayan müşteriler + önerilen temas.*
