---
tip: sistem/varlik-karti
kod: MRF-OS-03-RKP
surum: v1.0
tarih: 2026-07-05
sahip: Rakip Analiz
durum: onaylandi
---

# Varlık Kartı — RAKİP · `RKP-*`

**Amaç:** Rakiplerin ve fiyat hamlelerinin gözlem günlüğü.
**ID:** `RKP-<YIL>-<5hane>` · **Sahip:** Rakip Analiz · **Şablon:** `Templates/08_Rakip_Karti.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | RKP-* | ✅ | benzersiz |
| unvan | metin | ✅ | — |
| bolge | liste | ops | çakışan bölgeler |
| fiyat_gozlemleri | tablo | ops | tarih-ürün-fiyat-kaynak |
| guclu_yon | metin | ops | — |
| zayif_yon | metin | ops | — |

## Fiyat Gözlem Günlüğü
Her gözlem `guven` puanıyla (B7.4): söylenti(0) vs belge/ekran görüntüsü(2). Rakip hamlesi → uyarı-25.

## İlişkiler (≥3)
Çakışan ürünler (MFX) · Etkilediği müşteriler (CAR) · Bölge · Rakip MOC
