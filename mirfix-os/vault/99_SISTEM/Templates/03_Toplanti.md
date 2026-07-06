---
tip: kayit/toplanti
kod: 
durum: tamamlandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
saat: <% tp.date.now("HH:mm") %>
sahip: Ahmet
tur: # ic | dis | tedarikci | bayi
katilimcilar: []
guven: 3
iliskiler:
  - "[[10_SIRKET_MOC]]"
  - "[[]]"
  - "[[]]"
etiketler:
  - tip/toplanti
  - durum/onaylandi
---

# Toplantı — <% tp.date.now("YYYY-MM-DD") %>

**Katılımcılar:** 
**Tür:** 

## Gündem
1. 
2. 

## Görüşülenler

## Kararlar
> Her karar ayrıca [[07_Karar]] notuna çıkarılır (SSOT).
- 

## Aksiyonlar
- [ ] Aksiyon 1 📅 <% tp.date.now("YYYY-MM-DD", 3) %> #gorev/genel @Ahmet [[<% tp.file.title %>]]
- [ ] Aksiyon 2 📅 <% tp.date.now("YYYY-MM-DD", 7) %> #gorev/genel @Mehmet [[<% tp.file.title %>]]
