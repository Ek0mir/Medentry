---
tip: sistem/varlik-karti
kod: MRF-OS-03-PRJ
surum: v1.0
tarih: 2026-07-05
sahip: Satış/CEO
durum: onaylandi
---

# Varlık Kartı — PROJE · `PRJ-*`

**Amaç:** İhale/şantiye işlerinin uçtan uca izi (PARA'nın "P"si). Şablon vaka: Dulkadiroğlu.
**ID:** `PRJ-<YIL>-<5hane>` · **Sahip:** Satış/CEO · **Şablon:** `Templates/11_Proje.md` · **Drive:** `80_PROJELER/`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | PRJ-* | ✅ | benzersiz |
| ad | metin | ✅ | — |
| musteri | [[CAR]] | ✅ | var |
| tip | seçim | ✅ | ihale/şantiye/keşif |
| tahmini_hacim | sayı | ops | ton/TL |
| durum | seçim | ✅ | takip/teklif/kazanıldı/uygulama/kapandı |
| sorumlu | rol | ✅ | — |

## Yaşam Döngüsü
`takip → teklif(TKL) → kazanıldı/kaybedildi → uygulama(SIP/SVK) → kapandı(referans REF)`

## İlişkiler (≥3)
Müşteri (CAR) · Teklifler (TKL) · Siparişler (SIP) · Referans (REF) · Proje MOC
