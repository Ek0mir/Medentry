---
tip: sistem/varlik-karti
kod: MRF-OS-03-TED
surum: v1.0
tarih: 2026-07-05
sahip: Satın Alma
durum: onaylandi
---

# Varlık Kartı — TEDARİKÇİ · `TED-*`

**Amaç:** Hammadde/hizmet tedarikçilerinin kaydı; kritiklik ve alternatif izleme. Örnek: Limak, Çimsa (çimento).
**ID:** `TED-<YIL>-<5hane>` · **Sahip:** Satın Alma · **Şablon:** `Templates/12_Tedarikci.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | TED-* | ✅ | benzersiz |
| unvan | metin | ✅ | — |
| kalem | seçim | ✅ | çimento/kum/ambalaj/kimyasal/hizmet |
| kritiklik | seçim | ✅ | kritik/önemli/normal |
| alternatif | liste[[TED]] | kritikse ✅ | ikinci kaynak |
| vade_gun | sayı | ops | — |
| son_fiyat | sayı | ops | fiyat izleme |
| teslim_performansi | seçim | ops | iyi/orta/zayıf |

## Yaşam Döngüsü
`aday → onaylı → tercih → izlemede → pasif`

## Erken Uyarı Bağı
Çimento fiyatı ±%5 (uyarı-15), teslimat gecikmesi (uyarı-16) → Satın Alma Agent (4.14).

## İlişkiler (≥3)
Tedarik ettiği hammadde/ürün (MFX) · Üretim bağı (URE) · Alternatif tedarikçi · Satın Alma MOC
