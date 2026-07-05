---
tip: blueprint/bolum
kod: MRF-OS-06
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onaylandi
bagimlilik: [MRF-OS-03, MRF-OS-04, MRF-OS-05]
---

# BÖLÜM 6 — DASHBOARD SİSTEMİ
## 10 Rol Paneli + KPI Sözlüğü

> **Doktrin:** Dashboard rapor değildir; **karar tetikleyicidir.** Her panel bir soruya
> cevap verir ve bir sonraki hamleyi önerir. "Ölçülmeyen yönetilmez" ilkesinin (İlke 8)
> canlı yüzüdür. Her KPI'nın tek bir tanımı vardır (§6.11 KPI Sözlüğü, Ek F ile eş) —
> aynı metrik iki panelde farklı hesaplanamaz.

---

## 6.0 Panel Anatomisi (ortak standart)

Her panel şu 6 bloktan oluşur:

1. **KPI Kartları** — sayısal göstergeler; her kartta: değer, önceki döneme Δ, eşik rengi.
2. **AI Yorum Bloğu** — ilgili agent'ın (B4) o panele düşen 2-3 cümlelik yorumu; her iddia vault linkli.
3. **Önerilen Kararlar** — "Şunu yapmalısın" listesi; her biri Durum-Kanıt-Öneri-Onay formatında (B8.3).
4. **Risk Sinyalleri** — Erken Uyarı Kütüphanesi'nden (B8.6) tetiklenen kırmızı bayraklar.
5. **Detay Sorgular** — tıklayınca açılan Dataview tabloları (canlı kayıtlar).
6. **Tazelik Damgası** — verinin en son ne zaman güncellendiği + kaynak WF.

### Eşik Renk Standardı
| Renk | Anlam | Aksiyon |
|---|---|---|
| 🟢 Yeşil | Hedefte / normal | İzle |
| 🟡 Sarı | Sınırda / dikkat | Bu hafta bak |
| 🔴 Kırmızı | Eşik aşıldı | Bugün müdahale |
| ⚪ Gri | Veri yok / bayat | Kaynağı kontrol et |

---

## 6.1 CEO Dashboard — Şirket Nabzı (9 Kart)

Sabah 07:30 brifingin (B8) görsel karşılığı. 9 kart:

| # | Kart | Formül | Kaynak | Tazelik | Eşik |
|---|---|---|---|---|---|
| 1 | Bugünkü Nakit | Kasa + banka bakiye | 50_FINANS | Günlük | <hedef → 🔴 |
| 2 | Açık Sipariş Tutarı | Σ acik SIP tutar | 42_Siparisler | Anlık | — |
| 3 | Bugün Üretim (ton) | Σ günlük URE ton | 61_Uretim | Günlük | <ort×0.8 → 🟡 |
| 4 | Vadesi Geçen Alacak | Σ THS vade<bugün | 51_Tahsilat | Günlük | >limit → 🔴 |
| 5 | DSO (gün) | (Alacak/Ciro)×gün | Finans | Haftalık | >45 → 🟡 |
| 6 | Riskli Müşteri Sayısı | count(risk∈{F,G,H} & bakiye>0) | CAR | Günlük | — |
| 7 | Bu Ay Ciro | Σ FAT bu ay | Muhasebe köprüsü | Günlük | vs hedef |
| 8 | Açık Şikâyet | count(SKY durum≠kapandı) | 62_Kalite | Anlık | >3 → 🟡 |
| 9 | Kritik Stok Sinyali | count(hammadde<eşik) | Satın Alma | Günlük | var → 🔴 |

**AI Yorum:** CEO Agent (4.2) 9 kartı sentezler → "Bugün 3 şeye bak" cümlesi.

---

## 6.2 Satış Dashboard
KPI: bu ay/hafta ciro, teklif→sipariş dönüşüm oranı, ortalama sipariş tutarı, bölge kırılımı
(Pazarcık/Türkoğlu/Adıyaman/Kırıkhan), kaybedilen teklif nedeni pareto, A-sınıfı müşteri kapsaması.
AI yorum: Satış Agent (4.3). Karar önerisi: "Bu 5 açık teklifi bugün ara."

## 6.3 Üretim Dashboard
KPI: **ton/gün** (trend), **duruş nedenleri pareto** (çimento-kum-arıza-elektrik), vardiya verimi,
plan-gerçekleşme sapması, fire oranı. AI yorum: Üretim Agent (4.8) — "Dün duruşun %60'ı elektrik;
jeneratör bakımı gündeme al."

## 6.4 Kalite Dashboard
KPI: açık şikâyet, şikâyet/iade oranı, ürün bazlı şikâyet (en çok şikâyet alan MFX), kök-neden pareto,
ortalama çözüm süresi, tekrar eden şikâyet. AI yorum: Kalite Agent (4.9).

## 6.5 Tahsilat Dashboard
KPI: **DSO**, **alacak yaşlandırma** (0-30/31-60/61-90/90+), **söz-tutma oranı** (verilen ödeme
sözünün tutulma %'si), vadesi geçen top-10, risk sınıfı × bakiye ısı haritası, bu hafta aranacaklar.
AI yorum: Tahsilat Agent (4.5) — risk matrisi + THS eskalasyonu. Karar: eskalasyon kademesi önerir.

## 6.6 CRM Dashboard
KPI: **ziyaret kapsaması** (planlanan/gerçekleşen), **uyuyan müşteri** (60 gün sipariş yok),
son ziyaretten bu yana geçen gün (A-sınıfı), aday→aktif dönüşüm, iletişim sıklığı sapması.
AI yorum: CRM Agent (4.4) — "Bu 4 A-müşterisi 3 haftadır ziyaret edilmedi."

## 6.7 Pazarlama Dashboard
KPI: **içerik→talep hunisi** (atom sayısı→erişim→gelen soru→teklif), kanal performansı (6 kanal),
içerik takvimi doluluk, en çok dönüşen içerik tipi. AI yorum: Pazarlama Agent (4.10).

## 6.8 İhracat Dashboard
KPI: açık ihracat fırsatı, ülke kırılımı, teklif→sözleşme, döviz pozisyonu, belge tamamlanma
(proforma/ETGB/menşe). AI yorum: İhracat Agent (4.12). (Yol haritası 25-36 ay — B9.4.)

## 6.9 İK Dashboard
KPI: personel sayısı/devir, açık pozisyon, avans/maaş oranı, izin durumu, eğitim tamamlanma,
vardiya doluluk. AI yorum: İK Agent (4.15).

## 6.10 Finans Dashboard
KPI: **nakit köprüsü** (açılış→tahsilat→ödeme→kapanış), 4 haftalık nakit projeksiyonu, çek portföyü
(vade dağılımı), alacak-borç dengesi, gider kategori kırılımı, banka-kasa mutabakat farkı.
AI yorum: Finans Agent (4.6) — nakit sıkışması erken uyarısı.

---

## 6.11 KPI Sözlüğü — 60+ Metriğin Tek Tanımı (özet)

> Tam tablo **Ek F**'te. Her metrik: kod, ad, formül, kaynak, tazelik, hedef, sahip.

| Kod | Metrik | Formül | Kaynak | Tazelik |
|---|---|---|---|---|
| KPI-FIN-01 | DSO | (Ort. Alacak / Net Ciro) × Gün | THS+FAT | Haftalık |
| KPI-FIN-02 | Nakit Pozisyon | Kasa+Banka−Yakın Vadeli Borç | 50_FINANS | Günlük |
| KPI-FIN-03 | Söz-Tutma Oranı | Tutulan Söz / Verilen Söz | THS.odeme_sozu | Haftalık |
| KPI-SAT-01 | Teklif Dönüşüm | Kazanılan TKL / Gönderilen TKL | TKL | Haftalık |
| KPI-SAT-02 | Ort. Sipariş Tutarı | Σ SIP tutar / SIP sayısı | SIP | Günlük |
| KPI-CRM-01 | Ziyaret Kapsaması | Ziyaret Edilen A / Toplam A | CAR+Ziyaret | Haftalık |
| KPI-CRM-02 | Uyuyan Müşteri | count(son sipariş > 60 gün) | CAR+SIP | Günlük |
| KPI-URT-01 | Günlük Ton | Σ vardiya ton | URE | Günlük |
| KPI-URT-02 | Duruş Süresi | Σ duruş dakika | URE | Günlük |
| KPI-KAL-01 | Şikâyet Oranı | SKY sayısı / SIP sayısı | SKY+SIP | Haftalık |
| KPI-TAH-01 | Vadesi Geçen | Σ THS (vade<bugün) | THS | Günlük |
| KPI-OS-01 | INBOX Sıfırlama Süresi | Ort. inbox→sınıf gün | 00_INBOX | Haftalık |
| … | *(toplam 60+, Ek F)* | | | |

---

## 6.12 Uygulama: Obsidian Sürümü vs Hafif Web

| Boyut | Obsidian (Dataview) | Hafif Web |
|---|---|---|
| Maliyet | Sıfır (vault içinde) | Sunucu + geliştirme |
| Kurulum | Hemen (M9) | 13-24 ay |
| Kimin için | İç ekip | Bayi/dış paylaşım |
| **Karar** | **Önce bu — v1** | Sonra, ihtiyaç doğunca |

Panellerin Obsidian uygulaması → `99_SISTEM/Dashboardlar/` (canlı Dataview notları).

---

## Uygulama Kontrol Listesi — Bölüm 6
- [ ] KPI Sözlüğü (Ek F) tamamlandı, her metriğin tek tanımı var
- [ ] 10 panel `Dashboardlar/` altında Dataview notu olarak kuruldu
- [ ] Eşik renkleri her kart için tanımlandı
- [ ] Her panele ilgili agent'ın AI yorum bloğu bağlandı
- [ ] CEO Dashboard 9 kartı brifing (B8) ile eşleştirildi
- [ ] Tazelik damgası her panelde WF kaynağını gösteriyor

## Sizden Beklenen Girdiler
| # | Soru | Neden gerekli |
|---|---|---|
| 1 | Aylık ciro/nakit hedef değerleri | Eşik renkleri için |
| 2 | Hammadde kritik stok eşikleri (çimento/kum ton) | Kart 9 sinyali |
| 3 | DSO hedefi (kaç gün?) | KPI-FIN-01 eşiği |

---
*MRF-OS-06 · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
