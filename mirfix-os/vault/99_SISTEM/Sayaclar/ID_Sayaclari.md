---
tip: sistem/sayac
kod: MRF-OS-SAYAC
surum: v1.0
sahip: Sistem
durum: aktif
---

# ID Sayaçları — Tek Sayaç Dosyası (SSOT)

> **Kural (B3.20):** Her yeni varlık kaydı ID'sini BURADAN alır. Numara verildikten
> sonra ilgili sayaç +1 artırılır. Bu dosya numara çakışmasını önleyen tek kaynaktır.
> ID formatı: `<ÖNEK>-<YIL>-<5 hane>` — örn. `CAR-2026-00042`, `SIP-2026-00817`.

| Varlık | Önek | Son Verilen No | Sonraki | Sahip Rol |
|---|:---:|:---:|:---:|---|
| Müşteri (Cari) | CAR | 00000 | CAR-2026-00001 | Satış |
| Ürün | MFX | (fiyat listesinden) | — | Ar-Ge/Ürün |
| Teklif | TKL | 00000 | TKL-2026-00001 | Satış |
| Sipariş | SIP | 00000 | SIP-2026-00001 | Satış |
| Tahsilat | THS | 00000 | THS-2026-00001 | Finans |
| Fatura | FAT | 00000 | FAT-2026-00001 | Muhasebe |
| Üretim Emri | URE | 00000 | URE-2026-00001 | Üretim |
| Sevkiyat | SVK | 00000 | SVK-2026-00001 | Depo-Sevkiyat |
| Toplantı | TOP | 00000 | TOP-2026-00001 | (değişken) |
| Görev | GRV | 00000 | GRV-2026-00001 | (atayan) |
| Personel | PER | 00000 | PER-2026-00001 | İK |
| Proje | PRJ | 00000 | PRJ-2026-00001 | Satış/CEO |
| Tedarikçi | TED | 00000 | TED-2026-00001 | Satın Alma |
| Bayi | BAY | 00000 | BAY-2026-00001 | Satış |
| Rakip | RKP | 00000 | RKP-2026-00001 | Rakip Analiz |
| Referans | REF | 00000 | REF-2026-00001 | Pazarlama |
| Şikâyet | SKY | 00000 | SKY-2026-00001 | Kalite |
| İade | IAD | 00000 | IAD-2026-00001 | Kalite |
| Karar | KRR | 00000 | KRR-2026-00001 | (karar sahibi) |

> **Not:** Ürün (MFX) kodları mevcut fiyat listesi kod sisteminden gelir; sayaçla
> üretilmez (B3.3). Yıl değişiminde sayaçlar sıfırlanmaz, yıl alanı ID'de tutulur.
