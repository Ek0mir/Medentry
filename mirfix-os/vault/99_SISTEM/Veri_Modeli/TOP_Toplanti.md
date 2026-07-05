---
tip: sistem/varlik-karti
kod: MRF-OS-03-TOP
surum: v1.0
tarih: 2026-07-05
sahip: değişken
durum: onaylandi
---

# Varlık Kartı — TOPLANTI · `TOP-*`

**Amaç:** Toplantıların not→karar→görev zincirine dönüşmesi; hafızaya bağlanması.
**ID:** `TOP-<YIL>-<5hane>` · **Sahip:** Toplantıyı düzenleyen rol · **Şablon:** `Templates/03_Toplanti.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | TOP-* | ✅ | benzersiz |
| baslik | metin | ✅ | — |
| tarih | tarih | ✅ | — |
| katilimcilar | liste | ✅ | rol/kişi |
| ilgili_musteri | [[CAR]] | ops | varsa |
| kararlar | liste[[KRR]] | ops | üretilen kararlar |
| gorevler | liste[[GRV]] | ops | üretilen görevler |
| kaynak | seçim | ✅ | yüzyüze/telefon/online/ses-kaydı |

## Yaşam Döngüsü
`planlandı → yapıldı → işlendi(karar+görev bağlandı)`

## İlişkiler (≥3)
Katılımcılar · İlgili müşteri/proje (CAR/PRJ) · Üretilen karar (KRR) · Üretilen görevler (GRV)
İş akışı: **WF-08** (ses/metin → özet + karar + görev + ilişkilendirme)
