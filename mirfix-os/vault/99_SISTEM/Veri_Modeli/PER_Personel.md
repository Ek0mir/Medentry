---
tip: sistem/varlik-karti
kod: MRF-OS-03-PER
surum: v1.0
tarih: 2026-07-05
sahip: İK
durum: onaylandi
---

# Varlık Kartı — PERSONEL · `PER-*`

**Amaç:** Çalışan kayıtları; maaş/avans bağı, rol-hafıza paketi (B7.5) sahibi.
**ID:** `PER-<YIL>-<5hane>` · **Sahip:** İK · **Şablon:** `Templates/14_Personel.md`
**Gizlilik:** Kişisel(KVKK) — erişim kısıtlı (B1.5).

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | PER-* | ✅ | benzersiz |
| ad_soyad | metin | ✅ | KVKK |
| rol | rol | ✅ | rol kataloğu |
| ise_giris | tarih | ✅ | — |
| maas | sayı | ✅ | gizli |
| avanslar | liste | ops | tarih-tutar |
| durum | seçim | ✅ | aktif/izinli/ayrıldı |
| yetkiler | liste | ✅ | erişim matrisi |

## Yaşam Döngüsü
`aday → aktif → (izinli) → ayrıldı(devir protokolü B7.5)`

## İlişkiler (≥3)
Rolü · Sahip olduğu kayıtlar (rol bazlı) · Avans/maaş (FIN) · İK MOC
