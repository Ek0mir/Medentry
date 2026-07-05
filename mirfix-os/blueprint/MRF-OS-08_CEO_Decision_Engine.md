---
tip: blueprint/bolum
kod: MRF-OS-08
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onaylandi
bagimlilik: [MRF-OS-04, MRF-OS-05, MRF-OS-06]
---

# BÖLÜM 8 — CEO DECISION ENGINE
## Her Sabah 07:30 WhatsApp'a Düşen Brifing

> **Doktrin:** CEO'nun işi veri toplamak değil, karar vermektir. Motor geceleri veriyi
> toplar, agent'lar analiz eder, CEO Agent sentezler; sabah 07:30'da tek mesaj düşer:
> "Bugün şu 3 şeye bak, şu kararı ver." **AI önerir, insan onaylar** — motor asla karar vermez.

---

## 8.1 Motor Mimarisi

```
23:00 GECE TOPLAYICILAR (WF-13 tetik)
   ├─ Finans toplayıcı → nakit, alacak, çek vadeleri
   ├─ Satış toplayıcı → açık teklif/sipariş, dönüşüm
   ├─ Üretim toplayıcı → ton, duruş, plan sapması
   ├─ Tahsilat toplayıcı → vadesi geçen, söz-tutma
   └─ Kalite toplayıcı → açık şikâyet, iade
        ↓
06:30 ANALİZCİLER (ilgili agent'lar B4)
   → her agent kendi alanını yorumlar, guven≥2 kanıtla
        ↓
07:00 CEO AGENT SENTEZİ (4.2)
   → 10 modülü tarar, önem sırasına dizer, "bugün 3 öncelik" seçer
        ↓
07:30 TESLİM
   → WhatsApp mesajı (CEO'ya özel) + vault notu (10_SIRKET/13_Kararlar/gunluk-brifing)
```

Her brifing bir **vault notu olarak arşivlenir** — geçmiş brifingler aranabilir, isabet ölçülebilir (§8.5).

---

## 8.2 10 Soru → 10 Modül

Her modül bir soruya cevap verir; cevabı bir agent üretir, kanıtı vault linklidir.

| # | Soru | Modül / Agent | Ana Kaynak | Çıktı |
|---|---|---|---|---|
| 1 | Bugün ne yapmalıyım? | Öncelik sentezi / CEO | Tüm modüller | 3 öncelik |
| 2 | Hangi müşteri riskli? | Risk / Tahsilat+CRM | CAR risk Δ + vade | Riskli top-5 |
| 3 | Kim ödemedi? | Tahsilat / Tahsilat | THS vadesi geçen | Aranacaklar |
| 4 | En kârlı / en çok satan ürün? | Ürün marjı / Finans+Satış | MFX marj + SIP | Ürün sıralaması |
| 5 | En çok şikâyet alan ürün? | Kalite / Kalite | SKY ürün kırılımı | Sorunlu ürün |
| 6 | Üretim darboğazı nerede? | Üretim / Üretim | Duruş pareto | Darboğaz nedeni |
| 7 | Stok riski var mı? | Tedarik / Satın Alma | Hammadde sinyali | Kritik stok |
| 8 | Bu haftanın kararı ne? | Karar gündemi / Strateji | Açık kararlar | Haftalık karar |
| 9 | Büyüme fırsatı nerede? | Fırsat / Strateji+Pazarlama | Talep sinyalleri | Fırsat notu |
| 10 | Dün ne oldu? | Özet / CEO | Gün kapanışı | Değişim özeti |

---

## 8.3 Karar Önerisi Formatı (standart)

Motorun her önerisi **beş parçalıdır** — kanıtsız öneri sunulmaz:

```
DURUM:    İbrahim Yapı 45 gündür ödeme yapmadı, bakiye 180.000 TL, risk sınıfı D→F.
KANIT:    [[THS-2026-00311]] · [[CAR-2026-00042]] · son 3 sipariş [[SIP-...]] (guven: 3)
SEÇENEKLER: (a) Yeni sevkiyatı blokla  (b) 30 gün ek süre + çek iste  (c) yüz yüze görüş
ÖNERİ:    (b) — geçmiş söz-tutma oranı %80, ilişki değerli; çekle güvence al.
GEREKEN ONAY: CEO / Finans — Sevkiyat Blokaj Kapısı (B1.4 Kapı-3)
```

Bu format hem brifingde, hem dashboard önerilerinde, hem agent çıktılarında aynıdır.

---

## 8.4 Haftalık Karar Toplantısı — Otomatik Gündem

Her Pazartesi 08:00, motor bir "Haftalık Karar Gündemi" notu üretir:
- Geçen haftanın kararları ve sonuçları (kapalı döngü — §8.5)
- Bu hafta beklemede olan kararlar (Modül 8'den)
- Erken uyarı sinyalleri (§8.6'dan tetiklenenler)
- Her gündem maddesi §8.3 formatında, sahibi ve son karar tarihi ile

Toplantı Agent (4.16) toplantı sonunda: not → karar → görev zincirini kurar.

---

## 8.5 Karar → Görev → Sonuç: Kapalı Döngü (Kararların Karnesi)

> Karar vermek yetmez; **kararın işe yarayıp yaramadığı ölçülür.**

```
KARAR (KRR-*) → GÖREV(ler) (GRV-*) → UYGULAMA → SONUÇ ÖLÇÜMÜ → ÖĞRENME (bilgi atomu)
```

Her karar notunda `beklenen_sonuc` ve `olcum_tarihi` alanı vardır. Ölçüm tarihinde motor sorar:
"Bu karar beklenen sonucu verdi mi?" → Evet/Kısmen/Hayır + neden. Bu, **kararların karnesidir**;
CEO'nun karar isabetini zamanla gösterir ve gelecekteki önerileri kalibre eder.

---

## 8.6 Erken Uyarı Sinyal Kütüphanesi — 30 Kural

Motor her gece bu 30 kuralı tarar; tetiklenen kural brifinge kırmızı bayrak olarak düşer.

| # | Sinyal | Eşik | Tetik |
|---|---|---|---|
| 1 | Müşteri sipariş sıklığı düştü | −%40 (90 gün) | CRM |
| 2 | Çek vadesi yoğunlaşması | Aynı hafta >X TL | Finans |
| 3 | Vadesi geçen alacak arttı | +%20 (hafta) | Tahsilat |
| 4 | DSO yükseliyor | 3 hafta üst üste ↑ | Finans |
| 5 | Nakit projeksiyonu negatif | 4 hafta içinde | Finans |
| 6 | A-müşterisi ziyaretsiz | >21 gün | CRM |
| 7 | Aday müşteri soğudu | 30 gün temassız | Satış |
| 8 | Teklif dönüşümü düştü | <ort×0.7 | Satış |
| 9 | Aynı ürüne tekrar şikâyet | ≥3 (ay) | Kalite |
| 10 | İade oranı arttı | +%50 | Kalite |
| 11 | Üretim ton düştü | <ort×0.8 (3 gün) | Üretim |
| 12 | Duruş süresi arttı | +%30 | Üretim |
| 13 | Tek duruş nedeni baskın | >%50 pareto | Üretim |
| 14 | Hammadde stoğu kritik | <emniyet | Satın Alma |
| 15 | Çimento fiyatı değişti | ±%5 | Satın Alma |
| 16 | Tedarikçi teslimatı gecikti | >söz | Satın Alma |
| 17 | Ödeme sözü tutulmadı | söz günü geçti | Tahsilat |
| 18 | Risk sınıfı kötüleşti | ≥1 kademe | Tahsilat |
| 19 | Yeni müşteri limitsiz sipariş | limit yok | Satış |
| 20 | Sipariş fiyat onaysız bekliyor | >24 saat | Satış |
| 21 | Sevkiyat gecikti | termin+1 | Sevkiyat |
| 22 | Palet iadesi birikti | >eşik | Sevkiyat |
| 23 | Mutabakat yanıtsız | >15 gün | Finans |
| 24 | Fatura kesilmedi | sevk+3 gün | Muhasebe |
| 25 | Rakip fiyat hamlesi | gözlem | Rakip Analiz |
| 26 | Bölge cirosu düştü | −%25 | Satış |
| 27 | Personel devri sinyali | çıkış işareti | İK |
| 28 | Açık görev birikti | >X / rol | Tüm |
| 29 | INBOX 24 saat kuralı ihlali | >24 saat | Sistem |
| 30 | Sistem yedeği başarısız | son yedek eski | Sistem |

---

## Uygulama Kontrol Listesi — Bölüm 8
- [ ] Gece toplayıcılar WF-13'e bağlandı (23:00)
- [ ] 10 modül ilgili agent'lara eşlendi
- [ ] Karar Önerisi 5-parça formatı tüm çıktılarda standart
- [ ] Haftalık gündem otomatik üretiliyor (Pazartesi 08:00)
- [ ] Karar notlarında `beklenen_sonuc` + `olcum_tarihi` zorunlu
- [ ] 30 erken uyarı kuralı kodlandı ve test edildi
- [ ] Brifing WhatsApp + vault notu olarak teslim ediliyor (07:30)

## Sizden Beklenen Girdiler
| # | Soru | Neden |
|---|---|---|
| 1 | Brifing hangi numara/gruba düşsün? | WF-13 teslim |
| 2 | Erken uyarı eşik değerleri (X'ler) | 30 kural kalibrasyonu |
| 3 | Ürün marj verisi erişimi | Modül 4 |

---
*MRF-OS-08 · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
