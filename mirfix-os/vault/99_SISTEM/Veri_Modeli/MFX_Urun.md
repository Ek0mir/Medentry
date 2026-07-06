---
tip: sistem/varlik-karti
kod: MRF-OS-03-MFX
surum: v1.0
tarih: 2026-07-05
sahip: Ar-Ge/Ürün
durum: onaylandi
---

# Varlık Kartı — ÜRÜN · `MFX-*`

**Amaç:** Üretilen/satılan tüm ürünlerin tek kataloğu. Kod çekirdeği mevcut **fiyat listesi
MFX-* kod sisteminden** alınır (sayaçla üretilmez).
**Sahip Rol:** Ar-Ge/Ürün · **Şablon:** `Templates/09_Urun.md` · **Drive:** `30_URUNLER/`

## Alanlar
| Alan | Tip | Kaynak | Zorunlu | Doğrulama |
|---|---|---|---|---|
| kod | MFX-* | fiyat listesi | ✅ | benzersiz |
| ad | metin | ürün | ✅ | — |
| marka | seçim | ürün | ✅ | MİRFİX/İzomir/Dimaxa/Bilfis |
| recete | [[link]] | Ar-Ge | ops | gizli |
| ambalaj_varyanti | liste | ürün | ✅ | torba/palet |
| palet_adedi | sayı | ürün | ✅ | torba/palet |
| tds_durumu | seçim | kalite | ✅ | var/eksik/güncelleniyor |
| msds_durumu | seçim | kalite | ✅ | var/eksik |
| fiyat_esnaf | sayı | fiyat listesi | ✅ | — |
| fiyat_bayi | sayı | fiyat listesi | ✅ | — |
| fiyat_proje | sayı | fiyat listesi | ✅ | — |
| maliyet | sayı | üretim/finans | ops | gizli |
| fason_uretilebilir | bayrak | üretim | ✅ | evet/hayır |

## Yaşam Döngüsü
`aktif → sınırlı → durduruldu`

## İlişkiler (≥3)
Reçete · Siparişlerde geçtiği SIP'ler · Şikâyetler (SKY) · Rakip fiyat gözlemi (RKP) · Ürün MOC
