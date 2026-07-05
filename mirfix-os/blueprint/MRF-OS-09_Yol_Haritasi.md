---
tip: blueprint/bolum
kod: MRF-OS-09
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onaylandi
bagimlilik: [tümü]
---

# BÖLÜM 9 — YOL HARİTASI (12 / 24 / 36 AY)
## Ay Ay, Tek Odaklı Uygulama Planı

> **Doktrin:** Her şeyi aynı anda kurmak, hiçbir şeyi kurmamaktır. **Ayda tek modül.**
> Önce yakalama, sonra otomasyon. Her modülün bir "bitti tanımı", bir sorumlusu ve bir
> saat bütçesi vardır. Kademeli devreye alma (İlke 6) bir tercih değil, kuraldır.

---

## 9.1 Uygulama İlkeleri
1. **Ayda tek modül** — paralel kurulum yok; bir modül "bitti" olmadan sonraki başlamaz.
2. **Önce yakalama, sonra otomasyon** — veri girişi elle oturmadan WF yazılmaz.
3. **Kabul testi** — her modülün, "çalışıyor" demek için geçmesi gereken somut testi var.
4. **Geriye uyum** — mevcut MRF-SAT formları ve MFX kodları hiç bozulmaz.

---

## 9.2 Faz 1 — Temel (0–12 Ay)

| Ay | Modül | Bitti Tanımı (kabul testi) | Sorumlu Rol | Saat/Hafta |
|---|---|---|---|---|
| M1 | Vault iskeleti + INBOX ritüeli | Vault kuruldu; 1 hafta INBOX sıfırlandı | CEO+Sistem | 6 |
| M2 | Müşteri + ürün göçü | 50 aktif CAR + MFX kataloğu vault'ta | Satış | 8 |
| M3 | WF-01 WhatsApp sipariş yakalama | 10 gerçek sipariş otomatik SIP taslağı oldu | Satış+Sistem | 6 |
| M4 | WF-03/04 tahsilat + mutabakat | Vade hatırlatma çalışıyor; 241 form aylık gidiyor | Finans | 6 |
| M5 | WF-06 üretim & kasa icmal | Foto→yapılandırılmış kayıt; tutarsızlık alarmı | Üretim | 5 |
| M6 | Tahsilat + Satış Agent | Agent'lar guven≥2 kanıtla öneri üretiyor | CEO | 6 |
| M7 | CEO Brifing v1 | 5 gün üst üste 07:30 brifing düştü | CEO | 4 |
| M8 | Sevkiyat + belge WF | WF-07 + WF-10 canlı; palet sayacı tutuyor | Depo | 5 |
| M9 | Dashboard v1 | CEO + Tahsilat + Satış panelleri canlı | CEO | 5 |
| M10 | İçerik fabrikası | 1 atom → 6 kanal (WF-09) çalışıyor | Pazarlama | 4 |
| M11 | Kalite-şikâyet döngüsü | SKY→kök-neden→görev kapanıyor | Kalite | 4 |
| M12 | v1.0 denetimi ve sertleştirme | Tüm kontrol listeleri geçti; yedek tatbikatı | CEO+Sistem | 6 |

**Faz 1 çıktısı:** Yakalama oturmuş, ilk agent'lar ve brifing çalışıyor, temel paneller canlı.

---

## 9.3 Faz 2 — Derinlik (13–24 Ay)
- Kalan agent'lar (Finans, Üretim, Kalite, Satın Alma, Pazarlama, Toplantı, İK…)
- Dashboard'ların tamamı (10 panel)
- TDS/MSDS + kalite entegrasyonu (Teknik Destek Agent devrede)
- **ERP seçim hazırlığı:** OS'in kendisi bir "gereksinim şartnamesi" üretir — hangi ERP
  gelirse gelsin OS veri modeline (B3) uymak zorundadır, tersine değil.
- Bayi portalı ışıması (bayilere sınırlı görünüm)

## 9.4 Faz 3 — Ölçek (25–36 Ay)
- İhracat modülü (İhracat Agent + Dashboard)
- Mobil arayüz iyileştirmeleri
- ERP/CRM entegrasyonu — **OS üstte kalır**, ERP bir "fiş" olarak takılır
- Fason müşteri portalı
- Çoklu tesis hazırlığı

---

## 9.5 Kaynak Planı (rol × haftalık saat)

| Rol | Faz 1 s/hafta | Faz 2 | Not |
|---|---|---|---|
| CEO / Kurucu | 4-6 | 3 | Onay kapıları + brifing |
| Satış (Ferhat B. rolü) | 6-8 | 5 | Göç + WF-01 |
| Finans / Kasa | 5-6 | 4 | Tahsilat + mutabakat |
| Üretim | 4-5 | 3 | İcmal WF |
| Sistem (iç/dış) | 6-8 | 4 | WF + agent kurulum |

**Dış destek ihtiyaç noktaları:** n8n kurulum/self-host, ilk agent prompt kalibrasyonu,
Dataview sorgu ince ayarı, KVKK metin hukuki kontrolü.

## 9.6 Bütçe Kalemleri
| Kalem | Tip | Not |
|---|---|---|
| Obsidian | Ücretsiz (Sync opsiyonel) | Çekirdek |
| n8n | Self-host (sunucu) / cloud | Ortam kararı B5.1 |
| AI API token | Aylık değişken | Model seçim tablosu B4.22 |
| WhatsApp Business API | Aylık | WF-01/03 için |
| Sunucu / yedek | Aylık | 3-2-1 (B1.5) |
| Donanım | Tek sefer | Sahada tablet/telefon |

## 9.7 Risk Kaydı ve B Planları
| Risk | Etki | B Planı |
|---|---|---|
| Kritik kişi ayrılır | Yüksek | Rol-Hafıza Paketi (B7.5); bilgi zaten yazılı |
| Araç fiyat/politika değişir | Orta | Araç-bağımsızlık: düz metin taşınabilir (İlke) |
| API kesintisi | Orta | Kill-switch (B5.0); elle mod devam eder |
| Benimseme direnci | Yüksek | Kademeli (İlke 6); önce en çok acı çeken süreç |
| Veri sızıntısı | Yüksek | Olay Müdahale Planı (B1.5) |

## 9.8 OS Başarı Metrikleri (kuzey yıldızı)
| Metrik | Başlangıç | 12 Ay Hedef |
|---|---|---|
| INBOX sıfırlama süresi | — | <24 saat |
| Otomatik yakalanan sipariş % | 0 | >%70 |
| Brifing isabet puanı (§8.5) | — | >%75 |
| Bilgi bulma süresi | dakikalar-saatler | <60 saniye |
| Yetim not oranı | — | <%5 |

---

## Uygulama Kontrol Listesi — Bölüm 9
- [ ] M1-M12 her ay için bitti-tanımı sahibiyle onaylandı
- [ ] Her modülün kabul testi yazıldı
- [ ] Kaynak planı haftalık saatlerle rollere tebliğ edildi
- [ ] Bütçe kalemleri onaylandı (araç lisansları + API token)
- [ ] Risk kaydı çeyreklik gözden geçirmeye alındı
- [ ] Başarı metrikleri CEO Dashboard'a bağlandı

## Sizden Beklenen Girdiler
| # | Soru | Neden |
|---|---|---|
| 1 | Aylık AI token bütçe tavanı | B4.22 model seçimi |
| 2 | n8n self-host mu cloud mu tercih | B5.1 ortam |
| 3 | Faz 1 başlangıç tarihi | M1-M12 takvimi |

---
*MRF-OS-09 · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
