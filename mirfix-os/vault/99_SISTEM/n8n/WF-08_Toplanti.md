---
tip: n8n-workflow
kod: WF-08
surum: v1.0
tarih: 2026-07-05
sahip: değişken
durum: onaylandi
---

# WF-08 — Toplantı İşleme (Ses/Metin → Özet + Karar + Görev)

**Tetikleyici:** Toplantı ses kaydı/metni yüklenince.
**Girdi:** Ses → transkript veya doğrudan metin.

## Adım Şeması
1. Transkript (ses ise)
2. Toplantı Agent (4.16): özet + kararlar + görevler + ilgili varlıklar
3. Kararlar → KRR taslağı (onay bekler)
4. Görevler → GRV (atanan rol + tarih)
5. İlişkilendirme: [[CAR]]/[[PRJ]] backlink

**İnsan Müdahale:** Kararların onayı; belirsiz isim çözümleme.
**Çıktı:** TOP kaydı + KRR/GRV zinciri. **KPI:** Toplantı→görev dönüşümü.
