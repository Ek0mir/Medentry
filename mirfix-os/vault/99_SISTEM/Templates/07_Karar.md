---
tip: kayit/karar
kod: 13.
karar_no: KRR-<% tp.date.now("YYYY") %>-
durum: onaylandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Ahmet
kapsam: # sirket | satis | finans | uretim | pazarlama
sorumlu:
gozden_gecirme:
guven: 3
iliskiler:
  - "[[10_SIRKET_MOC]]"
  - "[[]]"
  - "[[]]"
etiketler:
  - tip/karar
  - durum/onaylandi
---

# Karar KRR-<% tp.date.now("YYYY") %>- — <% tp.file.title.replace("07_Karar_","") %>

**Tarih:** <% tp.date.now("YYYY-MM-DD") %>
**Kapsam:** 

## Bağlam / Sorun

## Değerlendirilen Seçenekler
1. 
2. 

## KARAR
> AI önerir, insan onaylar.

## Gerekçe

## Sorumlu ve Takip
- Sorumlu: 
- Gözden geçirme tarihi: 

## Görevler
- [ ] Kararı uygula 📅 <% tp.date.now("YYYY-MM-DD", 7) %> #gorev/genel @Ahmet [[<% tp.file.title %>]]
