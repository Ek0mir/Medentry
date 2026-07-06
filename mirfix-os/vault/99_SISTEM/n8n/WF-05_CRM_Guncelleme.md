---
tip: n8n-workflow
kod: WF-05
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
---

# WF-05 — CRM Güncelleme (Ziyaret → Müşteri Dosyası)

**Tetikleyici:** Yeni ziyaret formu (MRF-SAT-MZF eş) doldurulunca.
**Girdi:** Ziyaret notu (müşteri, gözlem, talep, numune, söz).

## Adım Şeması
1. Ziyaret notunu ilgili CAR dosyasına işle (son_ziyaret güncelle)
2. Talep varsa → Satış/Ar-Ge görevi
3. Numune verildiyse → 15 gün takip görevi (numune kuralı)
4. Aday ise → dönüşüm hattına ekle

**AI Düğümü:** CRM Agent — ziyaretten görev ve fırsat çıkarımı.
**İnsan Müdahale:** Statü değişikliği onayı.
**Çıktı:** Güncel CAR + görevler. **KPI:** Ziyaret→görev dönüşümü, numune takibi.
