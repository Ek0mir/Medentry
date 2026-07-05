---
tip: kayit/gorev
kod: GRV-<% tp.date.now("YYYY") %>-
durum: acik # acik | devam | beklemede | tamam | iptal
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip:
atanan_rol:
oncelik: orta # yuksek | orta | dusuk
son_tarih: <% tp.date.now("YYYY-MM-DD", 3) %>
iliskiler: ["[[]]", "[[]]", "[[]]"]
etiketler: [tip/gorev]
---
# Görev — 

**Atanan rol:** · **Öncelik:** · **Son tarih:** 

## Tanım

## Tasks satırı
- [ ] <açıklama> ⏫ 📅 <% tp.date.now("YYYY-MM-DD", 3) %> #gorev/<alan> @<rol> [[<kaynak>]]
