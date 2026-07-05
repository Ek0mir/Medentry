---
tip: kayit/ziyaret
kod: 41.
form_esi: MRF-SAT-MZF
durum: tamamlandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
saat: <% tp.date.now("HH:mm") %>
sahip: Mehmet
musteri: "[[]]"
bolge: # pazarcik | turkoglu | adiyaman | kirikhan
kanal: saha
gorusulen_kisi:
konu: # tanisma | siparis | tahsilat | sikayet | numune | rutin
numune_verildi: hayir # evet | hayir
numune_urun:
numune_takip_tarihi:
sonuc: # olumlu | notr | olumsuz
sonraki_adim:
sonraki_ziyaret: <% tp.date.now("YYYY-MM-DD", 14) %>
guven: 3
iliskiler:
  - "[[40_SATIS_OPERASYON_MOC]]"
  - "[[]]"
  - "[[]]"
etiketler:
  - tip/ziyaret
  - kanal/saha
---

# Ziyaret — <% tp.date.now("YYYY-MM-DD") %>

**Müşteri:** 
**Görüşülen kişi:** 
**Bölge:** 

## Konuşulanlar

## Müşteri talepleri / itirazları

## Numune / Ürün
- Verilen numune:
- Takip (15 gün kuralı) 📅 <% tp.date.now("YYYY-MM-DD", 15) %>

## Sonuç ve Sonraki Adım
- Sonuç:
- Sonraki adım:

## Görevler
- [ ] Ziyaret sonrası aksiyon 📅 <% tp.date.now("YYYY-MM-DD", 2) %> #gorev/satis @Mehmet [[<% tp.file.title %>]]
