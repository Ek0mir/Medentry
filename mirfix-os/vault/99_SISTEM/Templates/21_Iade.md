---
tip: kayit/iade
kod: IAD-<% tp.date.now("YYYY") %>-
durum: talep # talep | onay | kabul | red
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Kalite
siparis: "[[]]"
musteri: "[[]]"
miktar: 0
neden: # uretim | ambalaj | nakliye | yanlis-urun | musteri
iliskiler: ["[[60_URETIM_KALITE_MOC]]", "[[]]", "[[]]"]
etiketler: [tip/iade, durum/talep]
---
# İade IAD- — <% tp.date.now("YYYY-MM-DD") %>

**Sipariş:** [[]] · **Müşteri:** [[]] · **Miktar:** · **Neden:** 

> İade kabulü Kapı-4 (İnsan-Onay) gerektirir (B1.4).

## Görevler
- [ ] İade kararı (onay kapısı) ⏫ 📅 <% tp.date.now("YYYY-MM-DD", 1) %> #gorev/kalite @Kalite [[<% tp.file.title %>]]
