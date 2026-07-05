---
tip: sistem/varlik-karti
kod: MRF-OS-03-SVK
surum: v1.0
tarih: 2026-07-05
sahip: Depo-Sevkiyat
durum: onaylandi
---

# Varlık Kartı — SEVKİYAT · `SVK-*` (+ Araç/Şoför alt varlıkları)

**Amaç:** Siparişin müşteriye ulaşma izi; ~46 plaka filonun ve nakliye ödemesinin bağı.
**ID:** `SVK-<YIL>-<5hane>` · **Sahip:** Depo-Sevkiyat · **Şablon:** `Templates/18_Sevkiyat.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | SVK-* | ✅ | benzersiz |
| siparis | [[SIP]] | ✅ | 3 onay tamam |
| arac_plaka | seçim | ✅ | filo listesi (46 plaka) |
| sofor | metin | ✅ | — |
| cikis_zamani | tarih-saat | ✅ | araç çıktı mesajı |
| teslim_durumu | seçim | ✅ | yolda/teslim/kısmi/iade |
| palet_gonderilen | sayı | ✅ | — |
| palet_iade | sayı | ops | iade sayacı |
| nakliye_tutari | sayı | ops | THS/ödeme bağı |

## Alt Varlık: ARAÇ
plaka · kapasite(ton) · durum(aktif/bakım) · sürücü ataması

## Yaşam Döngüsü
`hazırlanıyor → yolda → teslim → kapandı`

## Palet İade Sayacı
Gönderilen − iade = müşteride bekleyen palet. Eşik aşımı → uyarı-22 (B8.6).

## İlişkiler (≥3)
Sipariş (SIP) · Müşteri (CAR) · Araç/Şoför · Sevkiyat MOC
İş akışı: **WF-07** (sevkiyat bildirimi + palet sayacı)
