---
tip: harita
kod: MOC-
durum: aktif
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip:
etiketler: [tip/moc]
---
# MOC — <% tp.file.title %>

> Harita Notu (Map of Content): bir alanın giriş kapısı; ilgili notları gruplar.

## Alt Bölümler
- 

## Canlı Sorgu
```dataview
LIST FROM #tip/kayit
WHERE contains(iliskiler, this.file.link)
SORT tarih DESC
```
