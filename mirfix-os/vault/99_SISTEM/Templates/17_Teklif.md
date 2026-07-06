---
tip: kayit/teklif
kod: TKL-<% tp.date.now("YYYY") %>-
form_esi: TKL
durum: taslak # taslak | gonderildi | kazanildi | kaybedildi
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Satis
musteri: "[[]]"
toplam: 0
gecerlilik: <% tp.date.now("YYYY-MM-DD", 15) %>
kayip_nedeni: # fiyat | termin | rakip | ihtiyac-yok | iletisim
guven: 3
iliskiler: ["[[40_SATIS_OPERASYON_MOC]]", "[[]]", "[[]]"]
etiketler: [tip/teklif, durum/taslak]
---
# Teklif TKL- — 

**Müşteri:** [[]] · **Geçerlilik:** 

## Kalemler
| MFX Kod | Ürün | Miktar | Birim Fiyat | Tutar |
|---|---|---|---|---|
| | | | | |

**Toplam:** 

## Görevler
- [ ] 7. gün takip araması 📅 <% tp.date.now("YYYY-MM-DD", 7) %> #gorev/satis @Satis [[<% tp.file.title %>]]
