---
tip: sistem/varlik-karti
kod: MRF-OS-03-REF
surum: v1.0
tarih: 2026-07-05
sahip: Pazarlama
durum: onaylandi
---

# Varlık Kartı — REFERANS / UYGULAMA · `REF-*`

**Amaç:** Tamamlanan uygulama/proje referanslarının pazarlama varlığına dönüşmesi.
**ID:** `REF-<YIL>-<5hane>` · **Sahip:** Pazarlama · **Şablon:** `Templates/22_Referans_Uygulama.md` · **Drive:** `70_PAZARLAMA/`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | REF-* | ✅ | benzersiz |
| baslik | metin | ✅ | — |
| musteri | [[CAR]] | ops | izin varsa |
| proje | [[PRJ]] | ops | — |
| urunler | liste[[MFX]] | ✅ | kullanılan ürünler |
| gorseller | ek | ops | uygulama fotoğrafları |
| izin | bayrak | ✅ | müşteri paylaşım izni (KVKK) |

## Yaşam Döngüsü
`aday → içerik hazır → yayınlandı(WF-09)`

## İlişkiler (≥3)
Müşteri/proje (CAR/PRJ) · Kullanılan ürünler (MFX) · İçerik atomları · Pazarlama MOC
