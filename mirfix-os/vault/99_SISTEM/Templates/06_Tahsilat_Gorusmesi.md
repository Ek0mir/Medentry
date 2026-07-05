---
tip: kayit/tahsilat
kod: 52.
durum: acik # acik | soz-alindi | tahsil-edildi | riskli
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Ahmet
musteri: "[[]]"
bolge: # pazarcik | turkoglu | adiyaman | kirikhan
risk_sinifi: # A-H
bakiye: 0
vade_tarihi:
soz_verilen_tarih:
tahsil_durumu: bekliyor # bekliyor | kismi | tam | gecikmis
kanal: telefon # saha | telefon | whatsapp
guven: 3
iliskiler:
  - "[[50_FINANS_MOC]]"
  - "[[]]"
  - "[[]]"
etiketler:
  - tip/tahsilat
  - durum/acik
---

# Tahsilat Görüşmesi — <% tp.date.now("YYYY-MM-DD") %>

**Müşteri:** 
**Güncel bakiye:** 
**Vade tarihi:** 
**Risk sınıfı:** 

## Görüşme özeti

## Sonuç
- Söz verilen tarih: 
- Tutar: 
- Durum: 

## Görevler
- [ ] Söz verilen tarihte teyit ara 🔺 📅 <% tp.date.now("YYYY-MM-DD", 3) %> #gorev/tahsilat @Ahmet [[<% tp.file.title %>]]
