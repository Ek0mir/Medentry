---
tip: sistem/varlik-karti
kod: MRF-OS-03-CAR
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# Varlık Kartı — MÜŞTERİ (Cari) · `CAR-*`

**Amaç:** Şirketle ticari ilişkisi olan tüm gerçek/tüzel kişilerin tek kaydı. SSOT.
**ID Kuralı:** `CAR-<YIL>-<5hane>` (ör. `CAR-2026-00042`). Sayaç: `Sayaclar/ID_Sayaclari.md`.
**Sahip Rol:** Satış · **Şablon:** `Templates/01_Musteri.md` · **Drive:** `20_MUSTERILER/`

## Alanlar
| Alan | Tip | Kaynak | Zorunlu | Doğrulama |
|---|---|---|---|---|
| kod | metin | sayaç | ✅ | benzersiz |
| unvan | metin | satış | ✅ | — |
| segment | seçim | satış | ✅ | esnaf/bayi/proje/fason |
| risk_sinifi | A–H | risk matrisi | ✅ | 8 kademe |
| limit | sayı(TL) | finans | ✅ | risk sınıfına uygun |
| vade_gun | sayı | satış | ✅ | ≤ risk sınıfı tavanı |
| bolge | seçim | satış | ✅ | pazarcik/turkoglu/adiyaman/kirikhan |
| torba_marka_tercihi | metin | satış | ops | MİRFİX/İzomir/Dimaxa/Bilfis |
| iletisim_agaci | liste | satış | ops | isim-rol-tel |
| vergi_no | metin | satış | ✅(tüzel) | doğrula |

## Yaşam Döngüsü
`aday → aktif → izlemede → bloke → pasif`
- **izlemede:** risk sınıfı kötüleşti veya ödeme sözü tutulmadı
- **bloke:** yeni sevkiyat durdu (Kapı-3 onayı ile) — B1.4

## İlişkiler (≥3)
Siparişleri (SIP) · Tahsilatları (THS) · Teklifleri (TKL) · Şikâyetleri (SKY) · Ziyaretler · Bölge MOC

## İlgili Formlar
MRF-SAT-MK (müşteri kartı), MRF-SAT-MZF (ziyaret)
