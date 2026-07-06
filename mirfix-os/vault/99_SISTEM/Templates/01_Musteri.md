---
tip: kayit/musteri
kod: 21.
durum: onaylandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Satis_Ekomir
segment: # yapi-market | usta | muteahhit | bayi | fason
risk_sinifi: # A | B | C | D | E | F | G | H
limit: 0
vade: 30
bolge: # pazarcik | turkoglu | adiyaman | kirikhan
torba_marka_tercihi: # MİRFİX | İzomir | Dimaxa | Bilfis
ambalaj_tercihi: # sirink | strec | zimba | torba | palet
son_siparis: <% tp.date.now("YYYY-MM-DD") %>
eski_kod:
guven: 2
iliskiler:
  - "[[20_MUSTERILER_MOC]]"
  - "[[51._Cari_<% tp.file.title.replace("21._Musteri_","") %>]]"
  - "[[]]"
etiketler:
  - tip/musteri
  - durum/onaylandi
---

# <% tp.file.title %>

## Künye
- **Firma/Kişi:**
- **Yetkili:**
- **Telefon:**
- **Adres / Bölge:**

## Ticari Profil
- **Segment:**
- **Risk Sınıfı (A-H):**
- **Kredi Limiti / Vade:**
- **Tercih edilen ürünler:**
- **Torba marka tercihi:**

## İlişki Geçmişi
- İlk temas: <% tp.date.now("YYYY-MM-DD") %>
- Son sipariş:
- Not:

## Bağlı Kayıtlar
- Ziyaretler:
- Siparişler:
- Tahsilat:

## Görevler
- [ ] İlk ziyaret planla #gorev/satis 📅 <% tp.date.now("YYYY-MM-DD", 7) %> @Mehmet [[<% tp.file.title %>]]
