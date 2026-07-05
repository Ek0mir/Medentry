---
tip: kayit/siparis
kod: 42.
form_esi: SIP
siparis_no: SIP-<% tp.date.now("YYYY") %>-
durum: acik # acik | onaylandi | sevk-edildi | kapandi | iptal
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Mehmet
musteri: "[[]]"
bolge: # pazarcik | turkoglu | adiyaman | kirikhan
kanal: # saha | whatsapp | telefon | bayi
tutar: 0
para_birimi: TL
ambalaj: # sirink | strec | zimba | torba | palet
palet_sayisi: 0
termin: <% tp.date.now("YYYY-MM-DD", 5) %>
stok_teyit: bekliyor # bekliyor | teyitli | eksik
odeme_sekli: # pesin | vadeli
vade_gun: 30
guven: 3
iliskiler:
  - "[[40_SATIS_OPERASYON_MOC]]"
  - "[[]]"
  - "[[]]"
etiketler:
  - tip/siparis
  - durum/acik
---

# Sipariş <% tp.date.now("YYYY") %>- — <% tp.date.now("YYYY-MM-DD") %>

**Müşteri:** 
**WhatsApp grubu:** Mirfix sipariş

## Kalemler
| MFX Kod | Ürün | Marka | Miktar | Ambalaj | Birim Fiyat | Tutar |
|---|---|---|---|---|---|---|
| | | | | | | |

**Toplam:** 

## Sevkiyat
- Termin: 
- Ambalaj / palet: 
- Stok teyidi: 

## Görevler
- [ ] Stok teyidi al ⏫ 📅 <% tp.date.now("YYYY-MM-DD", 1) %> #gorev/uretim @Depo [[<% tp.file.title %>]]
- [ ] Sevkiyat planla 📅 <% tp.date.now("YYYY-MM-DD", 3) %> #gorev/lojistik @Depo [[<% tp.file.title %>]]
