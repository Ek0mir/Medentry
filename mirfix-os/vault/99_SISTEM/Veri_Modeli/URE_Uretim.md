---
tip: sistem/varlik-karti
kod: MRF-OS-03-URE
surum: v1.0
tarih: 2026-07-05
sahip: Üretim
durum: onaylandi
---

# Varlık Kartı — ÜRETİM EMRİ + GÜNLÜK ÜRETİM KAYDI · `URE-*`

**Amaç:** Üretim planı ve gerçekleşmesinin kaydı; kasa-icmal fotoğraf akışının yapılandırılmışı.
**ID:** `URE-<YIL>-<5hane>` · **Sahip:** Üretim · **Şablon:** `Templates/15_Uretim_Gunlugu.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| kod | URE-* | ✅ | benzersiz |
| tarih | tarih | ✅ | — |
| makine | seçim | ✅ | hat/makine kodu |
| vardiya | seçim | ✅ | gündüz/gece |
| urun | [[MFX]] | ✅ | var |
| ton | sayı | ✅ | >0 |
| durus_dakika | sayı | ops | — |
| durus_nedeni | seçim | duruşsa ✅ | çimento/kum/arıza/elektrik |
| fire | sayı | ops | — |
| kaynak_foto | ek | ops | WhatsApp icmal fotoğrafı |

## Duruş Nedeni Sözlüğü
`cimento-yok` · `kum-yok` · `ariza` · `elektrik` · `bakim` · `siparis-yok`

## Yaşam Döngüsü
`planlandı → üretimde → tamamlandı → icmal-doğrulandı`

## Tutarsızlık Alarmı (WF-06)
Fotoğraftan çıkan ton, plandan/ortalamadan sapıyorsa → "dün iyiydi niye düştü?" sorusu Üretim Agent'a.

## İlişkiler (≥3)
Ürün (MFX) · Kaynak siparişler (SIP) · Hammadde/tedarik (TED) · Üretim MOC
İş akışı: **WF-06** (üretim & kasa icmal)
