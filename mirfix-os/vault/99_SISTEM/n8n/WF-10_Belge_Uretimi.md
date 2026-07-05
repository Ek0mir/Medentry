---
tip: n8n-workflow
kod: WF-10
surum: v1.0
tarih: 2026-07-05
sahip: Sistem
durum: onaylandi
---

# WF-10 — Belge Üretimi (Şablon + Veri → docx/pdf)

**Tetikleyici:** Belge talebi (teklif PDF, form, mutabakat mektubu).
**Girdi:** Şablon + varlık verisi (YAML).

## Adım Şeması
1. Şablon seç (teklif/fatura/mutabakat/form)
2. Varlık verisini yerleştir (SSOT'tan)
3. docx/pdf üret → Drive'a yaz + vault'a bağla
4. İlgili WF'e döndür (WF-02, WF-04)

**İnsan Müdahale:** Yok (deterministik); içerik doğruluğu kaynak veriye bağlı.
**Retry:** Üretim hatası → 3 deneme + bildirim.
**Çıktı:** Doldurulmuş belge. **KPI:** Belge üretim süresi, elle düzeltme oranı.
