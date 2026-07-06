---
tip: agent
kod: MRF-OS-04-16
surum: v1.0
tarih: 2026-07-05
sahip: değişken
durum: onaylandi
katman: Destek
---

# Toplantı Agent (Not → Karar → Görev)

**Amaç:** Toplantı ses/metnini özete, karara ve göreve dönüştürmek; ilişkilendirmek.
**Yetki Sınırı:** Karar/görev taslağı üretir; kararlar sahibinin onayı ile kesinleşir.
**Girdi/Bellek:** TOP kaydı, katılımcılar, ilgili müşteri/proje.

## Karar Ağacı
Konuşulan her aksiyon → görev (atanan rol + son tarih). Her karar → KRR taslağı (onay bekler).

## Prompt İskeleti
```
<Ortak Başlık — ROL: Toplantı>
Görev: Toplantı metnini oku. Çıkar: (1) 3-5 maddelik özet (2) kararlar [KRR taslağı, onay gerekli]
(3) görevler [atanan rol + tarih] (4) ilgili varlıklar [[CAR/PRJ/...]]. İsim çözümlemede belirsizse sor.
```
**Periyot:** Anlık (WF-08). **KPI:** Toplantı→görev dönüşümü, kararların kayıt oranı.
