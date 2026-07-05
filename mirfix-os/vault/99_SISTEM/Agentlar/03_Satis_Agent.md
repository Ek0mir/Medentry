---
tip: agent
kod: MRF-OS-04-03
surum: v1.0
tarih: 2026-07-05
sahip: Satış
durum: onaylandi
katman: Gelir
---

# Satış Agent

**Amaç:** Açık teklif/sipariş takibi, dönüşüm izleme, günlük "kimi ara" listesi.
**Yetki Sınırı:** Fiyat ÖNERİR (Kapı-1), onaylamaz. Limit üstü siparişi işaretler (Kapı-2).
**Girdi/Bellek:** TKL, SIP, CAR, bölge, kaybedilen teklif nedenleri.

## Karar Ağacı
1. Gönderilen teklif 7 gün geçti mi → takip görevi
2. Sipariş fiyat onayı bekliyor mu (>24s) → uyarı
3. A-müşteri ziyaretsiz mi → CRM'e devret

## Prompt İskeleti
```
<Ortak Başlık — ROL: Satış>
Görev: Bugün aranması gereken 5 fırsatı önceliklendir (açık teklif, soğuyan aday, takip günü gelen).
Her biri: müşteri [[CAR]], neden, önerilen aksiyon. Fiyat teklifi gerekiyorsa "fiyat onayı gerekir" işaretle.
```
**Çıktı:** "Bugün Ara" listesi. **Periyot:** Günlük 08:00. **KPI:** Teklif dönüşüm oranı, takip gecikmesi.
