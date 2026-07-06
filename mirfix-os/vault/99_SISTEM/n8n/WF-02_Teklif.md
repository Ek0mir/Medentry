---
tip: n8n-workflow
kod: WF-02
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# WF-02 — Teklif Üretim / Gönderim / Takip

**Tetikleyici:** TKL kaydı "gönderilecek" işaretlenince.
**Girdi:** TKL şablonu (müşteri, kalemler, fiyat).

## Adım Şeması
1. TKL verisinden PDF üret (WF-10 belge motoru)
2. Fiyat onayı gerekiyorsa → WF-11 (FON) bekle
3. Müşteriye gönder (WhatsApp/e-posta) → durum=gönderildi
4. 7. gün: yanıt yoksa takip görevi (GRV) üret → Satış Agent
5. Kazanıldı → SIP'e dönüştür; Kaybedildi → kayıp_nedeni iste

**AI Düğümü:** Teklif metni taslağı + kayıp nedeni sınıflama.
**İnsan Müdahale:** Fiyat onayı (Kapı-1); gönderim teyidi.
**Retry:** Gönderim başarısız → 3 deneme + bildirim.
**Çıktı:** PDF + durum güncel TKL. **KPI:** Teklif dönüşüm oranı, takip gecikmesi.
