---
tip: n8n-workflow
kod: WF-14
surum: v1.0
tarih: 2026-07-05
sahip: Sistem
durum: onaylandi
---

# WF-14 — Sistem Sağlık & Yedek Kontrol

**Tetikleyici:** Günlük 02:00 (yedek) + çeyreklik (hafıza denetimi).

## Adım Şeması
1. **Yedek 3-2-1:** Git push kontrolü + Drive sürüm + aylık soğuk yedek doğrula
2. Yedek başarısız → uyarı-30 (CEO'ya)
3. **Hafıza denetimi (çeyreklik):** yetim not, kopuk bağ, bayat bilgi, sahipsiz kayıt taraması (B7.6)
4. **24 saat kuralı:** INBOX'ta 24 saati aşan → uyarı-29
5. Sağlık raporu → CEO Dashboard kartı

**İnsan Müdahale:** Restore tatbikatı (çeyreklik) onayı.
**Çıktı:** Sistem Sağlık Raporu + düzeltme görevleri. **KPI:** Yedek başarı %, yetim not oranı.

---

## Devreye Alma Sırası (B5.16 özet)
WF-01 → WF-03/04 → WF-06 → WF-13(brifing) → WF-07/10 → WF-02/05 → WF-09 → WF-08/11/12 → WF-14.
Bağımlılık: veri modeli (B3) ve yakalama oturmadan otomasyon yazılmaz (İlke 5-6).
