---
tip: sistem/sorgu
kod: MRF-OS-SORGU-SIS
surum: v1.0
tarih: 2026-07-05
sahip: Sistem
---

# Dataview Sorgu Kütüphanesi — Sistem & Bakım (Kurumsal Hafıza)

## 21) Yetim Notlar (3'ten az bağ)
```dataview
TABLE length(iliskiler) AS "Bağ Sayısı", sahip
FROM #tip/kayit OR #tip/bilgi
WHERE length(iliskiler) < 3
SORT length(iliskiler) ASC
```

## 22) Sahipsiz Kayıtlar
```dataview
TABLE tip, tarih
WHERE !sahip AND (contains(file.tags, "#tip"))
```

## 23) 24 Saat Kuralı İhlali (INBOX bekleyen)
```dataview
TABLE file.ctime AS "Girdi", tip
FROM "00_INBOX"
WHERE file.ctime <= date(today) - dur(1 days)
SORT file.ctime ASC
```

## 24) Bayat Bilgi (12 ay dokunulmamış, düşük güven)
```dataview
TABLE guven, file.mtime AS "Son Değişiklik"
FROM #tip/bilgi
WHERE guven <= 1 AND file.mtime <= date(today) - dur(365 days)
```

## 25) Açık Görevler — Role Göre
```dataview
TABLE WITHOUT ID atanan_rol AS "Rol", length(rows) AS "Açık Görev"
FROM #tip/gorev
WHERE durum = "acik" OR durum = "devam"
GROUP BY atanan_rol
SORT length(rows) DESC
```
