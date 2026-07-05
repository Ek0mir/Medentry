---
tip: sistem/varlik-karti
kod: MRF-OS-03-TKL
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# Varlık Kartı — TEKLİF · `TKL-*`

**Amaç:** Müşteriye sunulan fiyat tekliflerinin kaydı ve kazanç/kayıp öğrenmesi.
**ID:** `TKL-<YIL>-<5hane>` · **Sahip:** Satış · **Şablon:** `Templates/17_Teklif.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | TKL-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | var |
| kalemler | tablo | ✅ | MFX + miktar + fiyat |
| toplam | sayı | ✅ | — |
| gecerlilik | tarih | ✅ | — |
| durum | seçim | ✅ | taslak/gönderildi/kazanıldı/kaybedildi |
| kayip_nedeni | seçim | kayıpsa ✅ | fiyat/termin/rakip/ihtiyaç yok/iletişim |

## Yaşam Döngüsü
`taslak → gönderildi → (kazanıldı → SIP'e dönüşür) | (kaybedildi + neden)`

## Kayıp Nedeni Sözlüğü
fiyat-yüksek · termin-uzun · rakip-tercih · ihtiyaç-kalmadı · iletişim-koptu · bütçe-yok

## İlişkiler (≥3)
Müşteri (CAR) · Dönüştüğü Sipariş (SIP) · İlgili ürünler (MFX) · Satış MOC
İş akışı: **WF-02** (teklif üretim-gönderim-takip, 7. gün hatırlatma)
