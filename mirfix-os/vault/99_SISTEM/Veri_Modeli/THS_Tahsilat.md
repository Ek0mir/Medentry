---
tip: sistem/varlik-karti
kod: MRF-OS-03-THS
surum: v1.0
tarih: 2026-07-05
sahip: Finans
durum: onaylandi
---

# Varlık Kartı — TAHSİLAT · `THS-*` (+ Ödeme Sözü nesnesi)

**Amaç:** Müşteriden yapılacak/yapılan tahsilatların ve verilen ödeme sözlerinin izi.
**ID:** `THS-<YIL>-<5hane>` · **Sahip:** Finans · **Şablon:** `Templates/06_Tahsilat_Gorusmesi.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | THS-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | var |
| tutar | sayı | ✅ | — |
| vade | tarih | ✅ | — |
| kanal | seçim | ✅ | havale/kart-taksit/çek/elden |
| durum | seçim | ✅ | bekliyor/kısmi/tahsil/gecikti/eskalasyon |

## Ödeme Sözü Nesnesi (alt-kayıt)
| Alan | Açıklama |
|---|---|
| soz_tarihi | Müşterinin ödeme vaat ettiği gün |
| soz_tutari | Vaat edilen tutar |
| tutuldu_mu | evet/kısmen/hayır → **söz-tutma oranı** KPI'sini besler |

## Çekin Ayrı Yaşam Döngüsü
`alındı → portföyde → tahsile verildi → (ödendi | karşılıksız → SKY/hukuk)`

## Eskalasyon (Tahsilat Agent 4.5 + risk matrisi)
Vade −7 / 0 / +7 / +14 / +30 kademeleri → **WF-03**. +30'da CEO onayı ile sevkiyat blokajı (Kapı-3).

## İlişkiler (≥3)
Müşteri (CAR) · İlgili sipariş/fatura (SIP/FAT) · Risk sınıfı · Finans MOC
