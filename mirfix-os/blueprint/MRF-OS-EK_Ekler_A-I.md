---
tip: blueprint/ekler
kod: MRF-OS-EK
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onaylandi
---

# EKLER A–I
## Şablon · YAML · Sorgu · Şema · Prompt · KPI · RACI · Terimler · Envanter Eşlemesi

---

## EK A — Şablon Kütüphanesi Dizini (24 Şablon)

Fiziksel konum: `vault/99_SISTEM/Templates/`

| # | Dosya | Varlık | Form Eşi |
|---|---|---|---|
| 01 | 01_Musteri.md | Müşteri (CAR) | MRF-SAT-MK |
| 02 | 02_Ziyaret.md | Ziyaret | MRF-SAT-MZF |
| 03 | 03_Toplanti.md | Toplantı (TOP) | — |
| 04 | 04_Gunluk_Not.md | Günlük Not | — |
| 05 | 05_Siparis.md | Sipariş (SIP) | MRF-SAT-SIP |
| 06 | 06_Tahsilat_Gorusmesi.md | Tahsilat (THS) | — |
| 07 | 07_Karar.md | Karar (KRR) | — |
| 08 | 08_Rakip_Karti.md | Rakip (RKP) | — |
| 09 | 09_Urun.md | Ürün (MFX) | — |
| 10 | 10_Sikayet.md | Şikâyet (SKY) | — |
| 11 | 11_Proje.md | Proje (PRJ) | — |
| 12 | 12_Tedarikci.md | Tedarikçi (TED) | — |
| 13 | 13_Bayi.md | Bayi (BAY) | — |
| 14 | 14_Personel.md | Personel (PER) | — |
| 15 | 15_Uretim_Gunlugu.md | Üretim (URE) | — |
| 16 | 16_Icerik_Atomu.md | İçerik | — |
| 17 | 17_Teklif.md | Teklif (TKL) | MRF-SAT-TKL |
| 18 | 18_Sevkiyat.md | Sevkiyat (SVK) | — |
| 19 | 19_Fatura.md | Fatura (FAT) | — |
| 20 | 20_Gorev.md | Görev (GRV) | — |
| 21 | 21_Iade.md | İade (IAD) | — |
| 22 | 22_Referans_Uygulama.md | Referans (REF) | — |
| 23 | 23_Bilgi_Atomu.md | Bilgi Atomu | — |
| 24 | 24_MOC_Harita.md | Harita Notu (MOC) | — |

---

## EK B — YAML Property Sözlüğü (Tam Alan Tablosu)

> Kontrollü alan seti. Şablonlar yalnızca bu alanları kullanır; yeni alan CR süreciyle (B1.6) eklenir.

| Alan | Tip | Zorunlu | Geçerli Değerler / Açıklama |
|---|---|---|---|
| `tip` | metin | ✅ | `kayit/*`, `bilgi/*`, `harita`, `agent`, `n8n-workflow`, `sistem/*` |
| `kod` | metin | ✅ | Varlık ID'si veya belge kodu |
| `durum` | metin | ✅ | Varlığa göre yaşam döngüsü (B3) |
| `tarih` | tarih | ✅ | YYYY-MM-DD |
| `sahip` | rol | ✅ | Rol kataloğu (B1.4) — kişi değil rol |
| `iliskiler` | liste[[link]] | ✅ (≥3) | 3-Bağlantı kuralı (B7.1) |
| `guven` | 0–3 | bilgi atomunda ✅ | Güven puanı (B7.4) |
| `bolge` | metin | ops | pazarcik / turkoglu / adiyaman / kirikhan |
| `musteri` | [[link]] | ilişkiliyse ✅ | CAR bağı |
| `urun` | [[link]] | ilişkiliyse ✅ | MFX bağı |
| `marka` | metin | ops | MİRFİX / İzomir / Dimaxa / Bilfis |
| `ambalaj` | metin | ops | sirink / strec / zimba / torba / palet |
| `tutar` | sayı | ops | TL |
| `vade_gun` | sayı | ops | Ödeme vadesi |
| `risk_sinifi` | A–H | CAR'da ✅ | Risk/kredi matrisi |
| `etiketler` | liste | ✅ | Etiket mimarisi (B2.5) |
| `surum` | metin | belgede ✅ | v0.x / v1.0 |

---

## EK C — Dataview Sorgu Kodları Dizini
Fiziksel konum: `vault/99_SISTEM/Sorgular/`. 25 kopyala-yapıştır sorgu 4 dosyada gruplu:
`Tahsilat_Sorgulari.md`, `Satis_CRM_Sorgulari.md`, `Uretim_Kalite_Sorgulari.md`, `Sistem_Bakim_Sorgulari.md`.

## EK D — n8n WF Şema Çizimleri Dizini
Fiziksel konum: `vault/99_SISTEM/n8n/` — WF-01 … WF-14, her biri mermaid akış şemalı.

## EK E — Agent Prompt Tam Metinleri Dizini
Fiziksel konum: `vault/99_SISTEM/Agentlar/` — 18 agent, her biri çalışabilir sistem promptu.

---

## EK F — KPI Formülleri Tablosu (60+ Metrik)
Tam tanım: `vault/99_SISTEM/Dashboardlar/00_KPI_Sozlugu.md`. Kısaltılmış çekirdek B6.11'de.
Kod şeması: `KPI-<ALAN>-<NO>` (FIN, SAT, CRM, URT, KAL, TAH, IHR, IK, PZR, OS).

## EK G — Erişim ve RACI Matrisleri
- **Erişim matrisi:** rol × (Drive klasörü, vault bölümü, n8n credential, WhatsApp grubu) → B1.4
- **RACI:** 12 kritik karar × (Öneren-Onaylayan-Uygulayan-Bilgilenen) → B1.3
- **9 İnsan-Onay Kapısı:** fiyat, limit, sevkiyat serbest, iade kabul, sözleşme, ödeme talimatı,
  fason kabul, üretim planı, bayi ataması → B1.4

---

## EK H — Terimler Sözlüğü (seçme)
| Kısaltma | Açılım |
|---|---|
| SSOT | Single Source of Truth — Tek Doğru Kaynak |
| WF | Workflow — n8n iş akışı |
| MOC | Map of Content — Harita Notu |
| DSO | Days Sales Outstanding — Alacak Tahsil Süresi |
| RACI | Responsible-Accountable-Consulted-Informed |
| TDS / MSDS | Teknik / Güvenlik Bilgi Formu |
| KVKK | Kişisel Verilerin Korunması Kanunu |
| FON | Fiyat Onayı (WhatsApp buton kapısı) |
| SIP / TKL / THS | Sipariş / Teklif / Tahsilat varlık önekleri |
| guven | Bilgi Güven Puanı (0–3) |
| AI-KOS | Mevcut Obsidian+Claude+n8n bilgi/otomasyon sistemi |

---

## EK I — 2026 Belge Envanteri ↔ MİRFİX OS Eşleme Tablosu

| Mevcut Varlık (2026) | OS Adresi | Kullanım |
|---|---|---|
| 22 belgelik satış seti (MRF-SAT-*) | B3 varlık şablonları / Ek A | Form → şablon eşi |
| Ürün fiyat listesi + MFX-* kod | B3.3 ÜRÜN + `30_URUNLER/` | Ürün çekirdeği |
| 8 kademeli risk/kredi matrisi | B3.2 CAR risk + 4.5 Tahsilat Agent | Risk sınıfı A–H |
| 241 formluk mutabakat sistemi | WF-04 + `50_FINANS/53_Mutabakat/` | Aylık otomasyon |
| Nakit akış / alacak-borç analizleri | B6.10 Finans Dashboard | Başlangıç KPI |
| AI-KOS (Obsidian+Claude+n8n) | B2 + B7 temeli; PZR → WF-09 | Vault + hafıza |
| WhatsApp operasyon arşivi | WF-01 + WF-06 | Sipariş + kasa icmal |

---
*MRF-OS-EK · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
