---
tip: sistem/varlik-karti
kod: MRF-OS-03-GRV
surum: v1.0
tarih: 2026-07-05
sahip: atayan
durum: onaylandi
---

# Varlık Kartı — GÖREV · `GRV-*`

**Amaç:** Yapılacak işlerin role atanmış, izlenebilir kaydı. Obsidian Tasks ile entegre.
**ID:** `GRV-<YIL>-<5hane>` (Tasks satırı da olabilir) · **Sahip:** Atayan rol · **Şablon:** `Templates/20_Gorev.md`

## Alanlar
| Alan | Tip | Zorunlu | Doğrulama |
|---|---|---|---|
| aciklama | metin | ✅ | — |
| atanan_rol | rol | ✅ | rol kataloğu (B1.4) |
| oncelik | seçim | ✅ | ⏫ yüksek / 🔼 orta / 🔽 düşük |
| son_tarih | tarih | ✅ | 📅 |
| durum | seçim | ✅ | açık/devam/beklemede/tamam/iptal |
| kaynak | [[link]] | ✅ | hangi kayıttan doğdu |
| tekrar | seçim | ops | günlük/haftalık/aylık |

## Tasks Sözdizimi Örneği
`- [ ] Stok teyidi al ⏫ 📅 2026-07-06 #gorev/uretim @Depo [[SIP-2026-00817]]`

## Yaşam Döngüsü
`açık → devam → (beklemede) → tamam | iptal`

## İlişkiler (≥3)
Kaynak kayıt (SIP/TOP/KRR…) · Atanan rol · İlgili müşteri/proje · Görev MOC
