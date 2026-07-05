# MİRFİX OS v1.0 — Kurumsal İşletim Sistemi

> **MİRFİX OS bir yazılım değil, yazılımların ÜZERİNDE yaşayan işletim sistemidir.**
> ERP, CRM, muhasebe programı ve AI modeli değişebilir; bu depoda tanımlanan veri
> modeli, klasör-kod düzeni, karar akışları ve kurumsal hafıza değişmez. Tüm tasarım
> **araç-bağımsızlık** ilkesiyle yapılmıştır: her bilgi düz metin (Markdown/CSV)
> olarak saklanır, her araç bu katmana bağlanan bir "fiş"tir.

| | |
|---|---|
| **Şirket** | MİRFİX Yapı Kimyasalları — EKOMİR İnşaat Müh. Robotik San. ve Tic. Ltd. Şti. |
| **Adres** | Gayberli Mah. 28042 Sk. No: 34/A, Onikişubat / KAHRAMANMARAŞ |
| **İletişim** | Tel 0532 252 35 77 • info@mirfix.com • www.mirfix.com |
| **Belge Kodu** | MRF-OS-000 |
| **Sürüm** | v1.0 / 05.07.2026 |
| **Sahibi** | Chief Systems Architect Ofisi |

---

## Bu Depo Nedir?

Bu depo, MİRFİX OS Master Blueprint'in **çalışan iskeletidir**. İki katmandan oluşur:

1. **`blueprint/`** — Sistemin *tasarımı*. 10 bölüm + ekler halinde, her katmanın
   neden ve nasıl kurulduğunu anlatan ana plan belgeleri (MRF-OS-00 … MRF-OS-09).
2. **`vault/`** — Sistemin *canlı uygulaması*. Obsidian vault olarak açılabilen,
   Johnny Decimal × PARA hibrit klasör düzeninde gerçek bilgi çekirdeği; şablonlar,
   sorgular, veri modeli kartları, agent anayasaları, n8n iş akışı şemaları ve
   dashboard'lar burada yaşar.

```
mirfix-os/
├── README.md                     ← buradasınız
├── MRF-OS-000_Icindekiler.md     ← ana harita / içindekiler
├── blueprint/                    ← 10 bölüm + ekler (tasarım)
│   ├── MRF-OS-00_Giris_Ilkeler_Envanter.md
│   ├── MRF-OS-01_Dijital_Omurga.md
│   ├── MRF-OS-02_Obsidian_Mimarisi.md
│   ├── MRF-OS-03_Veri_Modeli.md
│   ├── MRF-OS-04_Agent_Ekosistemi.md
│   ├── MRF-OS-05_n8n_Otomasyon.md
│   ├── MRF-OS-06_Dashboard_Sistemi.md
│   ├── MRF-OS-07_Kurumsal_Hafiza.md
│   ├── MRF-OS-08_CEO_Decision_Engine.md
│   ├── MRF-OS-09_Yol_Haritasi.md
│   └── MRF-OS-EK_Ekler_A-I.md
└── vault/                        ← canlı bilgi çekirdeği (Obsidian)
    ├── 00_INBOX/                 ← yakalama alanı (24 saat kuralı)
    ├── 10_SIRKET/                ← kimlik, sözleşmeler, kararlar
    ├── 20_MUSTERILER/            ← aktif / aday / bayi / fason
    ├── 30_URUNLER/               ← MFX kod ağacı
    ├── 40_SATIS_OPERASYON/       ← teklif · sipariş · sevkiyat
    ├── 50_FINANS/                ← tahsilat · kasa · mutabakat
    ├── 60_URETIM_KALITE/         ← üretim günlüğü · kalite
    ├── 70_PAZARLAMA/             ← içerik fabrikası (AI-KOS)
    ├── 80_PROJELER/              ← ihale / şantiye
    ├── 90_ARSIV/                 ← süresi dolan / kapanan kayıtlar
    └── 99_SISTEM/                ← şablon · sorgu · veri modeli · agent · n8n · dashboard
```

## Nasıl Kullanılır?

- **Okumaya nereden başlanmalı?** → [`MRF-OS-000_Icindekiler.md`](MRF-OS-000_Icindekiler.md)
  ana haritadır; oradan bölümlere gidin.
- **Obsidian ile açmak için** → `vault/` klasörünü Obsidian'da "vault olarak aç".
  `99_SISTEM/Templates` klasörünü Templater eklentisinde şablon dizini olarak tanımlayın.
- **Uygulama sırası** → [Bölüm 9 Yol Haritası](blueprint/MRF-OS-09_Yol_Haritasi.md):
  ayda tek modül, önce yakalama sonra otomasyon.

## 10 Kurucu İlke (özet)

1. Tek Doğru Kaynak (SSOT)
2. Her bilginin bir sahibi var
3. Yazılmayan bilgi yok hükmündedir
4. AI önerir, insan onaylar
5. Önce yakala, sonra mükemmelleştir
6. Kademeli devreye alma
7. Her kayıt en az 3 bağlantı
8. Ölçülmeyen yönetilmez
9. Sürümsüz belge yayınlanmaz
10. Sistem patrona değil, role çalışır

> Ayrıntı için → [Bölüm 0 §0.4](blueprint/MRF-OS-00_Giris_Ilkeler_Envanter.md)

---
*Hazırlayan: Chief Systems Architect Ofisi · Onay: CEO / Kurucu · Sürüm v1.0 / 05.07.2026*
