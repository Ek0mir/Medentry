---
tip: sistem/varlik-karti
kod: MRF-OS-03-SIP
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# Varlık Kartı — SİPARİŞ · `SIP-*`

**Amaç:** Kesinleşen satış siparişlerinin kaydı; sevkiyat ve faturanın çıkış noktası.
**ID:** `SIP-<YIL>-<5hane>` · **Sahip:** Satış · **Şablon:** `Templates/05_Siparis.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | SIP-* | ✅ | benzersiz |
| musteri | [[CAR]] | ✅ | var |
| whatsapp_kaynak | link/alıntı | ops | "Mirfix sipariş" grubu mesajı |
| kalemler | tablo | ✅ | MFX/marka/miktar/ambalaj |
| **onay_stok** | bayrak | ✅ | teyitli olmadan sevk yok |
| **onay_risk** | bayrak | ✅ | limit/vade uygun mu |
| **onay_fiyat** | bayrak | ✅ | FON — WhatsApp buton onayı |
| termin | tarih | ✅ | — |
| durum | seçim | ✅ | açık/onaylandı/sevk-edildi/kapandı/iptal |

> **3 Zorunlu Onay (B3.5):** stok-risk-fiyat üçü de ✅ olmadan sipariş "onaylandı" olamaz.

## Yaşam Döngüsü
`açık → onaylandı(3 onay) → sevk-edildi(SVK) → kapandı(FAT+THS)`

## İlişkiler (≥3)
Müşteri (CAR) · Kaynak teklif (TKL) · Sevkiyat (SVK) · Fatura (FAT) · Kaynak WhatsApp
İş akışı: **WF-01** (WhatsApp sipariş yakalama)
