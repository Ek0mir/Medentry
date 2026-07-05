---
tip: sistem/varlik-karti
kod: MRF-OS-03-BAY
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# Varlık Kartı — BAYİ · `BAY-*`

**Amaç:** Bayi ağının yönetimi; bölge, hedef, teminat izleme. (Referans: Sika/Weber bayi programı mantığı.)
**ID:** `BAY-<YIL>-<5hane>` · **Sahip:** Satış · **Şablon:** `Templates/13_Bayi.md` · **Drive:** `20_MUSTERILER/20.3_Bayi/`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | BAY-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | bayi cari |
| bolge | seçim | ✅ | münhasır bölge |
| aylik_hedef | sayı | ✅ | ton/TL |
| teminat | sayı | ✅ | limit güvencesi |
| durum | seçim | ✅ | aday/aktif/askıda/fesih |

## Yaşam Döngüsü
`aday → sözleşme → aktif → (askıda) → fesih`
> Bayi ataması **Kapı-9** (İnsan-Onay) gerektirir (B1.4).

## İlişkiler (≥3)
Bayi carisi (CAR) · Bölgesi · Sözleşme (10_SIRKET/12) · Satış MOC
