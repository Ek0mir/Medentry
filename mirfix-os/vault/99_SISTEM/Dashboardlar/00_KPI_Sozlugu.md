---
tip: sistem/kpi-sozlugu
kod: MRF-OS-06-KPI
surum: v1.0
tarih: 2026-07-05
sahip: CEO
durum: onaylandi
---

# KPI Sözlüğü — 60+ Metriğin Tek Tanımı (Ek F ile eş)

> Her metriğin TEK tanımı vardır. Aynı metrik iki panelde farklı hesaplanamaz.

| Kod | Metrik | Formül | Kaynak | Tazelik | Hedef |
|---|---|---|---|---|---|
| KPI-FIN-01 | DSO | (Ort.Alacak/Net Ciro)×gün | THS+FAT | Haftalık | <45 |
| KPI-FIN-02 | Nakit Pozisyon | Kasa+Banka−Yakın Borç | 50_FINANS | Günlük | >0 |
| KPI-FIN-03 | Söz-Tutma Oranı | Tutulan/Verilen söz | THS | Haftalık | >%80 |
| KPI-FIN-04 | 4 Hafta Projeksiyon | Nakit akış tahmini | Finans | Haftalık | pozitif |
| KPI-FIN-05 | Çek Vade Yoğunluğu | Hafta bazında çek toplamı | THS | Haftalık | dengeli |
| KPI-FIN-06 | Banka-Kasa Farkı | |Banka−Kasa mutabakat| | 52_Kasa | Günlük | ≈0 |
| KPI-SAT-01 | Teklif Dönüşüm | Kazanılan/Gönderilen TKL | TKL | Haftalık | >%40 |
| KPI-SAT-02 | Ort. Sipariş Tutarı | Σ SIP/adet | SIP | Günlük | ↑ |
| KPI-SAT-03 | Bölge Cirosu | Σ FAT bölgeye göre | FAT | Haftalık | — |
| KPI-SAT-04 | Kayıp Nedeni Payı | Neden başına kayıp % | TKL | Aylık | — |
| KPI-SAT-05 | Açık Sipariş Tutarı | Σ acik SIP | SIP | Anlık | — |
| KPI-CRM-01 | Ziyaret Kapsaması | Ziyaret A/Toplam A | CAR | Haftalık | >%80 |
| KPI-CRM-02 | Uyuyan Müşteri | count(sipariş>60g) | CAR+SIP | Günlük | ↓ |
| KPI-CRM-03 | Aday Dönüşüm | aktif olan/aday | CAR | Aylık | ↑ |
| KPI-URT-01 | Günlük Ton | Σ vardiya ton | URE | Günlük | plan |
| KPI-URT-02 | Duruş Süresi | Σ duruş dk | URE | Günlük | ↓ |
| KPI-URT-03 | Plan-Gerçekleşme | Gerçek/Plan | URE | Günlük | ≈1 |
| KPI-URT-04 | Fire Oranı | fire/üretim | URE | Günlük | <eşik |
| KPI-KAL-01 | Şikâyet Oranı | SKY/SIP | SKY | Haftalık | ↓ |
| KPI-KAL-02 | Çözüm Süresi | Ort. gün | SKY | Haftalık | <X |
| KPI-KAL-03 | İade Oranı | IAD/SIP | IAD | Haftalık | ↓ |
| KPI-KAL-04 | Tekrar Şikâyet | aynı ürün ≥3 | SKY | Aylık | 0 |
| KPI-TAH-01 | Vadesi Geçen | Σ THS(vade<bugün) | THS | Günlük | ↓ |
| KPI-TAH-02 | Yaşlandırma | 0-30/31-60/61-90/90+ | THS | Haftalık | — |
| KPI-TAH-03 | Eskalasyon Sayısı | +30 kademe adet | THS | Haftalık | ↓ |
| KPI-PZR-01 | İçerik→Talep Hunisi | atom→erişim→soru→teklif | İçerik | Aylık | ↑ |
| KPI-PZR-02 | Kanal Erişimi | Kanal başına erişim | Sosyal | Haftalık | — |
| KPI-IHR-01 | İhracat Dönüşüm | sözleşme/teklif | İhracat | Aylık | — |
| KPI-IK-01 | Personel Devri | ayrılan/toplam | PER | Çeyreklik | ↓ |
| KPI-IK-02 | Açık Pozisyon Süresi | ort. gün | PER | Aylık | ↓ |
| KPI-OS-01 | INBOX Sıfırlama | ort. inbox→sınıf gün | 00_INBOX | Haftalık | <1 |
| KPI-OS-02 | Otomatik Sipariş % | otomatik/toplam SIP | SIP | Haftalık | >%70 |
| KPI-OS-03 | Brifing İsabet | isabetli/toplam öneri | Brifing | Aylık | >%75 |
| KPI-OS-04 | Bilgi Bulma Süresi | ort. arama süresi | — | Çeyreklik | <60sn |
| KPI-OS-05 | Yetim Not Oranı | <3 bağ/toplam | Vault | Çeyreklik | <%5 |
| KPI-OS-06 | Yedek Başarı % | başarılı/toplam | WF-14 | Aylık | %100 |

> Not: Alt kırılımlarla (ürün/bölge/müşteri bazında) toplam 60+ metrik türetilir.
