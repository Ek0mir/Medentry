---
tip: sistem/varlik-karti
kod: MRF-OS-03-FAT
surum: v1.0
tarih: 2026-07-05
sahip: Muhasebe
durum: onaylandi
---

# Varlık Kartı — FATURA ve İRSALİYE · `FAT-*`

**Amaç:** Sevk edilen malın belge izi ve dış muhasebe köprüsü.
**ID:** `FAT-<YIL>-<5hane>` · **Sahip:** Muhasebe (dış muhasebe köprüsü) · **Şablon:** `Templates/19_Fatura.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | FAT-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | var |
| siparis | [[SIP]] | ✅ | var |
| irsaliye_no | metin | ✅ | — |
| e_belge_tipi | seçim | ✅ | e-fatura/e-arşiv/e-irsaliye |
| e_belge_uuid | metin | ✅ | e-belge sistemi |
| tutar | sayı | ✅ | SIP ile mutabık |
| kdv | sayı | ✅ | — |
| kesim_tarihi | tarih | ✅ | sevk+3 gün içinde (uyarı-24) |

## Yaşam Döngüsü
`taslak → kesildi → dış muhasebeye aktarıldı → arşiv (10 yıl)`

## Dış Muhasebe Köprüsü
Fatura verileri dış muhasebeye tek yönlü aktarılır; OS SSOT'tur, muhasebe programı bir "fiş".

## İlişkiler (≥3)
Müşteri (CAR) · Sipariş (SIP) · Sevkiyat (SVK) · Tahsilat (THS) · Muhasebe MOC
