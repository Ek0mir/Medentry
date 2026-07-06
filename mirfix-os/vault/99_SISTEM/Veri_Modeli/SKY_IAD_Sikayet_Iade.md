---
tip: sistem/varlik-karti
kod: MRF-OS-03-SKY-IAD
surum: v1.0
tarih: 2026-07-05
sahip: Kalite
durum: onaylandi
---

# Varlık Kartı — ŞİKÂYET · `SKY-*` ve İADE · `IAD-*`

**Amaç:** Müşteri şikâyetleri ve iadelerinin kök-neden odaklı kaydı; kalite öğrenme döngüsü.
**Sahip:** Kalite · **Şablon:** `Templates/10_Sikayet.md`, `Templates/21_Iade.md`

## ŞİKÂYET (SKY-*)
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | SKY-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | var |
| urun | [[MFX]] | ✅ | var |
| konu | metin | ✅ | — |
| kok_neden | seçim | çözümde ✅ | üretim/ambalaj/nakliye/kullanım/reçete |
| durum | seçim | ✅ | açık/inceleme/çözüm/kapandı |
| cozum_suresi | gün | ops | KPI-KAL |

## İADE (IAD-*)
| Alan | Tip | Zorunlu |
|---|---|---|
| kod | IAD-* | ✅ |
| siparis | [[SIP]] | ✅ |
| miktar | sayı | ✅ |
| neden | seçim | ✅ |
| durum | seçim | ✅ (talep/onay/kabul/red) |
> İade kabulü **Kapı-4** (İnsan-Onay) gerektirir (B1.4).

## Kök Neden Sözlüğü
`uretim-hatasi` · `ambalaj` · `nakliye-hasar` · `yanlis-kullanim` · `recete` · `yanlis-urun`

## İlişkiler (≥3)
Müşteri (CAR) · Ürün (MFX) · Kaynak sipariş (SIP) · Kalite MOC
İş akışı: Kalite Agent (4.9) kök-neden; tekrar eden şikâyet → uyarı-9.
