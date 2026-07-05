---
tip: sistem/harita
kod: MRF-OS-000
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onay-iskeleti
---

# MİRFİX OS v1.0 — MASTER BLUEPRINT ANA PLANI
## Detaylı İçindekiler ve Üretim Planı

> MİRFİX OS bir yazılım değil, yazılımların ÜZERİNDE yaşayan işletim sistemidir.
> ERP, CRM, muhasebe programı ve AI modeli değişebilir; burada tanımlanan veri
> modeli, klasör-kod düzeni, karar akışları ve kurumsal hafıza değişmez.

---

## BELGE HARİTASI — 10 BÖLÜM + EKLER

| Bölüm | Başlık | Hedef Sayfa | Bağımlılık | Belge | Durum |
|:---:|---|:---:|:---:|---|:---:|
| 0 | Giriş, İlkeler ve Mevcut Varlık Envanteri | ≈10 | — | [MRF-OS-00](blueprint/MRF-OS-00_Giris_Ilkeler_Envanter.md) | ✅ v1.0 |
| 1 | Dijital Omurga (bilgi-veri-karar-yetki-güvenlik) | ≈26 | B0 | [MRF-OS-01](blueprint/MRF-OS-01_Dijital_Omurga.md) | ✅ v1.0 |
| 2 | Obsidian Mimarisi (vault, şablon, sorgu) | ≈36 | B1 | [MRF-OS-02](blueprint/MRF-OS-02_Obsidian_Mimarisi.md) | ✅ v1.0 |
| 3 | Şirket Veri Modeli (17 varlık + ilişkiler) | ≈42 | B1-2 | [MRF-OS-03](blueprint/MRF-OS-03_Veri_Modeli.md) | ✅ v1.0 |
| 4 | AI Agent Ekosistemi (18 agent) | ≈48 | B3 | [MRF-OS-04](blueprint/MRF-OS-04_Agent_Ekosistemi.md) | ✅ v1.0 |
| 5 | n8n Otomasyon Mimarisi (14 iş akışı) | ≈40 | B3 | [MRF-OS-05](blueprint/MRF-OS-05_n8n_Otomasyon.md) | ✅ v1.0 |
| 6 | Dashboard Sistemi (10 panel + KPI sözlüğü) | ≈20 | B3-5 | [MRF-OS-06](blueprint/MRF-OS-06_Dashboard_Sistemi.md) | ✅ v1.0 |
| 7 | Kurumsal Hafıza Motoru | ≈14 | B2-3 | [MRF-OS-07](blueprint/MRF-OS-07_Kurumsal_Hafiza.md) | ✅ v1.0 |
| 8 | CEO Decision Engine (sabah brifingi) | ≈14 | B4-6 | [MRF-OS-08](blueprint/MRF-OS-08_CEO_Decision_Engine.md) | ✅ v1.0 |
| 9 | Yol Haritası (36 ay, ay ay) | ≈14 | Tümü | [MRF-OS-09](blueprint/MRF-OS-09_Yol_Haritasi.md) | ✅ v1.0 |
| EK | Ekler A–I (şablon, YAML, sorgu, prompt, KPI) | ≈16 | — | [MRF-OS-EK](blueprint/MRF-OS-EK_Ekler_A-I.md) | ✅ v1.0 |
| | **TOPLAM HEDEF HACİM** | **≈280** | | | |

---

## ÇALIŞMA YÖNTEMİ

Her bölüm ayrı belge olarak üretilir (MRF-OS-00 … MRF-OS-09), sırasıyla onaya
sunulur ve v1.0'a yükseltilir; en sonda tek ciltte birleşir. Her bölümün sonunda
o bölüme ait **Uygulama Kontrol Listesi** bulunur — böylece blueprint bittiğinde
uygulama planı da hazırdır. Teslim sırası bağımlılığa göredir: veri modeli (B3)
yazılmadan agent'lar (B4) yazılamaz; bu yüzden n8n (B5) agent'lardan önce gelir.
Hiçbir bölümde varsayım yapılmaz; eksik bilgi bölüm sonunda **"Sizden Beklenen
Girdiler"** tablosuyla sorulur.

---

## AYRINTILI İÇİNDEKİLER

### BÖLÜM 0 — GİRİŞ, İLKELER ve MEVCUT VARLIK ENVANTERİ
- 0.1 Amaç, Kapsam ve Hedef Okuyucu
- 0.2 MİRFİX OS Nedir / Ne Değildir — yazılım değil, işletim sistemi
- 0.3 Tasarım Felsefesi: Araç-Bağımsızlık Doktrini
- 0.4 10 Kurucu İlke
- 0.5 Mevcut Varlık Envanteri ve OS'e Bağlanma Adresleri
- 0.6 Referans Model Analizi — Sika, Mapei, Weber Disiplini
- 0.7 Üst Mimari Şeması — 5 Katman
- 0.8 Terimler Sözlüğü ve Kısaltmalar
- 0.9 Blueprint Kullanım Kılavuzu ve Sürüm Politikası

### BÖLÜM 1 — DİJİTAL OMURGA
- 1.1 Bilginin Yaşam Döngüsü — Yakala → Sınıfla → İşle → Bağla → Arşivle → İmha
- 1.2 Veri Akış Mimarisi (Altın Kayıt, Git sync, çevrimdışı)
- 1.3 Karar Akış Mimarisi (tipoloji, RACI, Karar Defteri)
- 1.4 Yetki ve Rol Yapısı (rol kataloğu, erişim matrisi, 9 onay kapısı)
- 1.5 Bilgi Güvenliği (KVKK, 3-2-1 yedek, olay müdahale)
- 1.6 Sürüm ve Değişiklik Yönetimi
- 1.7 Doküman Mimarisi (MRF-[ALAN]-[TİP]-[NO])
- 1.8 Kurumsal Hafıza İlkeleri + Uygulama Kontrol Listesi

### BÖLÜM 2 — OBSIDIAN MİMARİSİ
- 2.1 Vault Stratejisi (Johnny Decimal × PARA)
- 2.2 Kök Klasör Yapısı (00–99)
- 2.3 Not Tipolojisi (Zettelkasten uyarlaması)
- 2.4 Properties / YAML Sözlüğü
- 2.5 Etiket Mimarisi
- 2.6 Şablon Kütüphanesi (24 şablon)
- 2.7 Dataview Sorgu Kütüphanesi (25 sorgu)
- 2.8 Tasks Sistemi
- 2.9 Canvas Standardı
- 2.10 Günlük/Toplantı/Proje ritüelleri
- 2.11 Vault-içi Dashboard Notları
- 2.12 Eklenti Politikası
- 2.13 Mobil Senaryolar
- 2.14 Bakım Rutinleri + Uygulama Kontrol Listesi

### BÖLÜM 3 — ŞİRKET VERİ MODELİ (17 Varlık)
3.1 Modelleme Standardı · 3.2 MÜŞTERİ · 3.3 ÜRÜN · 3.4 TEKLİF · 3.5 SİPARİŞ ·
3.6 TAHSİLAT · 3.7 FATURA/İRSALİYE · 3.8 ÜRETİM · 3.9 SEVKİYAT · 3.10 TOPLANTI ·
3.11 GÖREV · 3.12 PERSONEL · 3.13 PROJE · 3.14 TEDARİKÇİ · 3.15 BAYİ · 3.16 RAKİP ·
3.17 REFERANS · 3.18 ŞİKÂYET/İADE · 3.19 İlişki Matrisi + ER · 3.20 Kimlik Kuralları ·
3.21 Veri Kalitesi + Uygulama Kontrol Listesi

### BÖLÜM 4 — AI AGENT EKOSİSTEMİ (18 Agent)
4.0 Agent Tasarım Standardı · 4.1 Katman Haritası · 4.2–4.19 18 Agent Dosyası ·
4.20 Agent'lar Arası Protokol · 4.21 Prompt Sürümleme · 4.22 Token/Maliyet ·
4.23 Güvenlik + Uygulama Kontrol Listesi

### BÖLÜM 5 — n8n OTOMASYON MİMARİSİ (14 İş Akışı)
5.0 Tasarım Standardı · 5.1 Ortam · 5.2–5.15 WF-01…WF-14 · 5.16 Devreye Alma Sırası
+ Uygulama Kontrol Listesi

### BÖLÜM 6 — DASHBOARD SİSTEMİ (10 Panel)
6.1 CEO · 6.2 Satış · 6.3 Üretim · 6.4 Kalite · 6.5 Tahsilat · 6.6 CRM ·
6.7 Pazarlama · 6.8 İhracat · 6.9 İK · 6.10 Finans · 6.11 KPI Sözlüğü (60+) ·
6.12 Uygulama + Kontrol Listesi

### BÖLÜM 7 — KURUMSAL HAFIZA MOTORU
7.1 3-Bağlantı Kuralı · 7.2 Otomatik İlişkilendirme · 7.3 Uçtan Uca Senaryo ·
7.4 Bilgi Güven Puanı · 7.5 Kişi Ayrılınca Bilgi Kalır · 7.6 Çeyreklik Denetim

### BÖLÜM 8 — CEO DECISION ENGINE
8.1 Motor Mimarisi · 8.2 10 Soru → 10 Modül · 8.3 Karar Önerisi Formatı ·
8.4 Haftalık Karar Toplantısı · 8.5 Karar → Görev → Sonuç · 8.6 Erken Uyarı (30 kural)

### BÖLÜM 9 — YOL HARİTASI (12 / 24 / 36 Ay)
9.1 İlkeler · 9.2 0–12 Ay · 9.3 13–24 Ay · 9.4 25–36 Ay · 9.5 Kaynak Planı ·
9.6 Bütçe · 9.7 Risk Kaydı · 9.8 Başarı Metrikleri

### EKLER A–I
A Şablon dizini · B YAML sözlüğü · C Dataview kodları · D n8n şemaları ·
E Agent prompt'ları · F KPI formülleri · G RACI matrisleri · H Terimler · I 2026 Belge Envanteri eşlemesi

---

*MRF-OS-000 · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
