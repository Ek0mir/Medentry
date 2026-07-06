---
tip: blueprint
kod: MRF-OS-02
baslik: Obsidian Mimarisi
surum: v1.0
tarih: 2026-07-05
sahip: EKOMİR / MİRFİX AI-KOS
durum: onaylandi
iliskiler:
  - "[[MRF-OS-01_Genel_Cerceve]]"
  - "[[MRF-OS-03_AI_KOS_Entegrasyon]]"
etiketler:
  - tip/blueprint
  - durum/onaylandi
guven: 3
---

# MRF-OS-02 — OBSIDIAN MİMARİSİ

> MİRFİX OS'un bilgi bedeni. Bu belge, EKOMİR/MİRFİX'in tüm kurumsal hafızasının nasıl bir Obsidian vault içinde yaşayacağını, klasör mantığını, not tiplerini, YAML sözlüğünü, etiket ağacını, şablon ve sorgu kütüphanelerini, günlük ritüelleri ve bakım rutinlerini tanımlar.
>
> Felsefe hatırlatması: **Araç-bağımsızlık** (her bilgi düz metin), **SSOT** (tek doğruluk kaynağı), **her kayıt en az 3 bağlantı**, **AI önerir – insan onaylar**.

---

## 2.1 Vault Stratejisi

### 2.1.1 Tek Vault Kararı

**KARAR:** MİRFİX tüm kurumsal bilgisini **tek bir Obsidian vault** içinde tutar. Vault adı: `MIRFIX-OS`.

**Gerekçe:**

1. **SSOT ihlali riski.** Çoklu vault, aynı müşteri/ürün/karar notunun iki yerde farklı hallerde yaşamasına yol açar. Tek vault, "bir kayıt = bir dosya" ilkesini garanti eder.
2. **Bağlantı grafiği bütünlüğü.** Obsidian'ın `[[wiki-link]]` grafiği vault sınırında kesilir. `21.03_Musteri_IbrahimCam` notunun `50.2_Tahsilat` ve `30.1_Urun_MFX-320` notlarına bağlanabilmesi için hepsinin aynı grafikte olması şart. Bir kaydın en az 3 bağlantı kuralı ancak tek grafik içinde denetlenebilir.
3. **Küçük ekip.** 5 kişi + AI agent için çoklu vault yönetimi (senkron, izin, eklenti sürümü çoğaltma) gereksiz operasyon yüküdür.
4. **Git sync tek repo.** AI-KOS'tan devralınan Git senkronu tek bir depoyu (`mirfix-os`) izler. Tek vault = tek repo = tek merge disiplini.
5. **AI erişimi.** Claude + n8n ajanı vault kökünü tek dizin olarak indeksler; çoklu vault, ajan bağlamını böler ve güven alanı (0-3) denetimini zorlaştırır.

**İstisna:** Yalnızca **kişisel/gizli** (bordro detayı, ortaklık müzakeresi) içerikler ayrı bir şifreli `MIRFIX-GIZLI` vault'ta tutulabilir; bu vault OS grafiğinin parçası değildir ve bu blueprintin kapsamı dışındadır.

### 2.1.2 Johnny Decimal × PARA Hibrit Modeli

MİRFİX iki köklü organizasyon sistemini birleştirir:

| Sistem | Ne getirir | MİRFİX'te karşılığı |
|---|---|---|
| **Johnny Decimal (JD)** | 00–99 numaralı, tahmin edilebilir, kısa adres (ör. `21.03`) | Kök klasör numaralandırması, dosya adı öneki, konuşma dili ("yirmi bir nokta üç") |
| **PARA (Projects–Areas–Resources–Archive)** | Eyleme göre kümeleme; aktif proje ≠ süregelen sorumluluk ≠ kaynak ≠ arşiv | 80_PROJELER = P, 10–70 arası kökler = Areas, 30/70 içerikleri = Resources, 90_ARSIV = A |

**Hibritleme kuralı:**

- **Numara (JD) = fiziksel adres.** Her şeyin bir numarası var, numara asla değişmez, taşınmaz. `21.03` daima İbrahim Cam'dır.
- **PARA = yaşam döngüsü katmanı.** Bir müşteri "Area"dır (süregelen ilişki); "Pazarcık deposu açılışı" bir "Project"tir (bitişi olan); ürün TDS'i bir "Resource"tur; kapanan proje "Archive"a taşınır.
- **Çakışma çözümü:** Bir kayıt hem alan hem proje ise, **fiziksel yeri Area'dır (numaralı kök), projeye `[[bağlantı]]` ile katılır.** Örn. İbrahim Cam `20_MUSTERILER` altında durur ama `80.4_Pazarcık_Depo_Projesi` notundan link'lenir.

Bu hibrit, "nerede duruyor?" (JD numarası) ile "şu an ne kadar canlı?" (PARA katmanı) sorularını ayırır.

---

## 2.2 Kök Klasör Yapısı (Johnny Decimal 00–99)

Vault kökünde **11 alan (area)** vardır. Her alan 10'luk bir blok tutar; ikinci seviye `X0.Y` alt kategorileri, üçüncü seviye ise `XY.NN` tekil kayıtları adresler.

```
MIRFIX-OS/
├── 00_INBOX/
├── 10_SIRKET/
├── 20_MUSTERILER/
├── 30_URUNLER/
├── 40_SATIS_OPERASYON/
├── 50_FINANS/
├── 60_URETIM_KALITE/
├── 70_PAZARLAMA/
├── 80_PROJELER/
├── 90_ARSIV/
└── 99_SISTEM/
```

### 00_INBOX — Yakalama tamponu
Sınıflandırılmamış her şeyin ilk düştüğü yer. Sahadan gelen 60 sn'lik müşteri notu, fotoğraf, WhatsApp ekran görüntüsü, "sonra bakılacak" fikirler. **Haftalık sıfırlanır (2.14).**
```
00_INBOX/
├── 00.01_Hizli_Notlar/
├── 00.02_Foto_Yakalama/
└── 00.03_Islenecek_WhatsApp/
Örnek dosya: 00.01_2026-07-05_Turkoglu_yeni_market_torba_talebi.md
```

### 10_SIRKET — Kurumsal kimlik ve yönetişim
```
10_SIRKET/
├── 10.1_Kimlik/         → 10.1.01_Vizyon_Misyon.md, 10.1.02_Marka_Kilavuzu_MİRFİX.md
├── 10.2_Sozlesmeler/    → 12.02_Sozlesme_Fason_XYZ.md, 12.05_Sozlesme_Nakliye_ABC.md
├── 10.3_Kararlar/       → 13.01_Karar_2026_Adiyaman_Bolge_Acilis.md
├── 10.4_Organizasyon/   → 14.01_Org_Semasi.md, 14.02_Rol_Tanimlari.md
└── 10.5_Yasal_Ruhsat/   → 15.01_Uretim_Izni.md, 15.02_TSE_Belgeleri.md
Örnek: 13.03_Karar_2026-07-01_Kirikhan_Bayi_Vade_45_Gun.md
```

### 20_MUSTERILER — Ticari ilişki ağı
```
20_MUSTERILER/
├── 20.1_Aktif/    → 21.03_Musteri_IbrahimCam.md, 21.07_Musteri_TurkogluYapi.md
├── 20.2_Aday/     → 22.01_Aday_AdiyamanInsaat.md
├── 20.3_Bayi/     → 23.02_Bayi_PazarcikMerkez.md
└── 20.4_Fason/    → 24.01_Fason_Musteri_KirikhanBeton.md
Örnek: 21.03_Musteri_IbrahimCam.md  (risk sınıfı, limit, vade, bölge, torba marka tercihi frontmatter'da)
```
> Not: Alt klasör numarası (21, 22, 23, 24) müşteri tipini kodlar. Bir aday müşteri (`22.xx`) satışa dönünce **numarası korunarak** `20.1_Aktif`e taşınır ve önekine `21.xx` yeni sıra numarası verilir; eski kod frontmatter `eski_kod:` alanında saklanır (bağlantılar kırılmasın).

### 30_URUNLER — MFX ürün ağacı
Ürün kodu ağacı `MFX-` öneki ile kurulur; kategori bandı ilk hane ile ifade edilir.
```
30_URUNLER/
├── 30.1_Yapistiricilar/   → 31.01_Urun_MFX-320_Seramik_Yapistirici.md
├── 30.2_Siva_Harclar/     → 32.01_Urun_MFX-410_Isi_Yalitim_Sivasi.md
├── 30.3_Su_Yalitim/       → 33.01_Urun_MFX-510_Suru_Membran_İzomir.md
├── 30.4_Derz_Dolgu/       → 34.01_Urun_MFX-610_Derz_Dolgu.md
├── 30.5_Astar_Katki/      → 35.01_Urun_MFX-710_Aderans_Astari.md
└── 30.9_Fiyat_Listeleri/  → 39.01_Fiyat_Listesi_MFX_2026Q3.md  (MFX-* fiyat seti eşi)
Örnek: 31.01_Urun_MFX-320_Seramik_Yapistirici.md  (marka: MİRFİX/Dimaxa, ambalaj: 25kg torba/palet)
```

### 40_SATIS_OPERASYON — Ziyaret, sipariş, sevkiyat, teklif
```
40_SATIS_OPERASYON/
├── 40.1_Ziyaretler/   → 41.14_Ziyaret_2026-07-05_IbrahimCam.md  (MRF-SAT-MZF eş)
├── 40.2_Siparisler/   → 42.221_Siparis_SIP-2026-0221_IbrahimCam.md  (SIP eş)
├── 40.3_Teklifler/    → 43.08_Teklif_2026-07-03_AdiyamanInsaat.md
├── 40.4_Sevkiyatlar/  → 44.55_Sevkiyat_2026-07-05_Plaka46AB123.md
├── 40.5_Iadeler/      → 45.02_Iade_2026-06-28_TurkoguYapi.md
└── 40.6_Sikayetler/   → 46.03_Sikayet_2026-06-30_Derz_Renk_Farki.md
```

### 50_FINANS — Tahsilat, cari, fatura
```
50_FINANS/
├── 50.1_Cari_Hesaplar/       → 51.03_Cari_IbrahimCam.md
├── 50.2_Tahsilat/            → 52.19_Tahsilat_Gorusme_2026-07-05_IbrahimCam.md
├── 50.3_Faturalar/           → 53.480_Fatura_FTR-2026-0480.md
├── 50.4_Odemeler_Tedarikci/  → 54.11_Odeme_Cimento_Tedarikci.md
└── 50.5_Risk_Limit/          → 55.01_Risk_Matrisi_A_H.md
Örnek: 52.19_Tahsilat_Gorusme_2026-07-05_IbrahimCam.md  (vade, bakiye, söz verilen tarih)
```

### 60_URETIM_KALITE — Fason, reçete, kalite, üretim günlüğü
```
60_URETIM_KALITE/
├── 60.1_Uretim_Gunlugu/  → 61.130_Uretim_2026-07-05_Vardiya1.md
├── 60.2_Receteler/       → 62.05_Recete_MFX-320.md
├── 60.3_Kalite_Kayit/    → 63.44_Kalite_Test_2026-07-05_Cimento_Parti.md
├── 60.4_Fason/           → 64.02_Fason_Is_Emri_2026-07-01.md
├── 60.5_Hammadde/        → 65.01_Hammadde_Cimento.md, 65.02_Hammadde_Kum.md
└── 60.6_Ambalaj/         → 66.01_Ambalaj_Standardi_Sirink_Strec_Zimba.md
```

### 70_PAZARLAMA — AI-KOS içerik fabrikası (PARA "Resources")
```
70_PAZARLAMA/
├── 70.1_Icerik_Atomlari/   → 71.088_Atom_Isi_Yalitim_Kis_Faydasi.md
├── 70.2_Yayin_Takvimi/     → 72.01_Yayin_Takvimi_2026Q3.md
├── 70.3_Kampanyalar/       → 73.04_Kampanya_2026_Kis_Yalitim.md
├── 70.4_Referans_Uygulama/ → 74.12_Referans_Kirikhan_Villa_Su_Yalitim.md
├── 70.5_Rakip_Kartlari/    → 75.03_Rakip_Karti_XMarka.md
└── 70.6_Sablonlar_Gorsel/  → 76.01_Sosyal_Medya_Sablonu.md
```
> AI-KOS bağlantısı: `71.xxx` içerik atomları, `guven:` alanına göre AI tarafından taslaklaştırılır, insan onayı ile `72.xx` yayın takvimine bağlanır.

### 80_PROJELER — PARA'nın "P"si (bitişi olan işler)
```
80_PROJELER/
├── 80.1_Aktif/    → 81.04_Proje_Pazarcik_Depo_Acilis.md
├── 80.2_Beklemede/→ 82.02_Proje_Adiyaman_Bolge_Genisleme.md
└── 80.3_Fikir/    → 83.07_Proje_Fikri_Bayi_Mobil_Siparis.md
Örnek: 81.04_Proje_Pazarcik_Depo_Acilis.md  (kilometre taşları, sorumlu, bitiş tarihi)
```
> Proje tamamlanınca frontmatter `durum: tamamlandi` yapılır ve **çeyreklik bakımda** `90_ARSIV`e taşınır.

### 90_ARSIV — Ölü ama silinmeyen (PARA "A")
Kapanan müşteri, biten proje, eski fiyat listesi, süresi dolmuş sözleşme. **Numara ve ad korunur**, başına `ARS_` etiketi eklenmez — yalnızca klasör değişir, bağlantılar canlı kalır.
```
90_ARSIV/
├── 90.1_Musteriler/
├── 90.2_Projeler/
├── 90.3_Fiyat_Listeleri/
└── 90.4_Sozlesmeler/
```

### 99_SISTEM — OS'un kendisi
```
99_SISTEM/
├── Templates/    → 24 Templater şablonu (Bkz. 2.6)
├── Sorgular/     → 4 Dataview sorgu dosyası (Bkz. 2.7)
├── Dashboards/   → Kontrol paneli notları (Bkz. 2.11)
├── 99.1_Sozlukler/  → YAML alan sözlüğü (Ek B), etiket sözlüğü, kod sözlüğü
├── 99.2_Ritueller/  → günlük/haftalık/aylık akış notları
└── 99.9_Meta/       → bu blueprint kopyası, sürüm notları
```

---

## 2.3 Not Tipolojisi (Zettelkasten Uyarlaması)

MİRFİX üç temel not tipi tanır. Kural: **her not tam olarak bir tiptir** (`tip:` alanı zorunlu).

### A) Kayıt Notu (Record)
Gerçek dünyada olmuş/olan bir olay ya da varlık. Zaman ve kimlik taşır.
- Örnekler: bir ziyaret (`41.14`), bir sipariş (`42.221`), bir müşteri (`21.03`), bir tahsilat görüşmesi (`52.19`), bir üretim vardiyası (`61.130`).
- Özellik: **değiştirilemez tarihçe.** Bir ziyaret notu sonradan yeniden yazılmaz; yeni ziyaret = yeni not.

### B) Bilgi Atomu (Knowledge Atom)
Tek, bağımsız, yeniden kullanılabilir bir doğruluk/iddia/kural/tanım. AI-KOS'un yapı taşı.
- Örnekler: "MFX-320 açık kalma süresi 20 dk'dır" (`23_Bilgi_Atomu`), bir pazarlama iddiası (`71.088`), bir fiyatlandırma kuralı.
- Özellik: **atomik** (tek fikir), **kaynaklı** (`kaynak:`), **güven derecesi taşır** (`guven: 0-3`).

### C) Harita Notu / MOC (Map of Content)
Diğer notlara giriş kapısı; kendi içeriği azdır, esas işi **yönlendirmek**.
- Örnekler: `20_MUSTERILER` alan MOC'u, "Su Yalıtım Ürünleri" MOC, "Tahsilat Süreci" MOC.
- Özellik: içerik üretmez, **navigasyon** üretir. Dashboard'lar (2.11) MOC'ların canlı, Dataview'lu türevleridir.

### İlişki Kuralları
1. **Kayıt notu → en az 1 varlık MOC'una ve en az 2 diğer kayda bağlanır** (3 bağlantı kuralı). Örn. ziyaret → müşteri + (önceki ziyaret | sipariş).
2. **Bilgi atomu → en az 1 ürün/konu MOC'una + türetildiği kaynağa bağlanır.**
3. **MOC → yalnızca link toplar; ham veri tutmaz.** Ham veri kayıt notunda yaşar.
4. **Kayıt notu, iddia içerince o iddiayı bilgi atomuna çıkarır** ("atomlaştırma"): ör. ziyarette "müşteri Dimaxa markasını İzomir'e tercih ediyor" cümlesi ayrı bir bilgi atomu olur ve ziyaretten link'lenir.

```
[MOC: Müşteriler] ──indeksler──> [Kayıt: 21.03 İbrahim Cam]
                                        │ atomlaştırır
                                        ▼
                            [Bilgi Atomu: İbrahim Cam palet teslim ister, guven:2]
```

---

## 2.4 Properties / YAML Sözlüğü

Her not YAML frontmatter ile başlar. Alanlar iki gruba ayrılır: **evrensel zorunlu** (her not) ve **tipe özel** (Ek B).

### Evrensel Zorunlu Alanlar
```yaml
tip:        # not tipi — kayit | atom | moc | sablon | blueprint (ve alt-tipler: musteri, ziyaret, siparis...)
kod:        # JD kodu — ör. 21.03 (MOC ve atomlarda opsiyonel olabilir)
durum:      # taslak | onaylandi | beklemede | tamamlandi | arsiv | kayip
tarih:      # YYYY-MM-DD — oluşturma/olay tarihi
sahip:      # sorumlu kişi/rol — ör. Satis_Ekomir | Uretim | AI-KOS
iliskiler:  # []  — en az 3 [[wiki-link]] (3 bağlantı kuralı burada denetlenir)
```

### AI-KOS'tan Devralınan `guven` Alanı (0–3)
Tüm **bilgi atomlarında zorunlu**, kayıt notlarında opsiyoneldir. AI'ın bir iddiaya ne kadar güvenerek davranabileceğini kodlar:

| guven | Anlam | AI davranışı |
|---|---|---|
| **0** | Doğrulanmamış / söylenti | Kullanma, yalnızca "iddia var" diye işaretle |
| **1** | Tek kaynak, teyitsiz | Öneride "muhtemelen" ile ver, insan teyidi iste |
| **2** | Güvenilir tek kaynak / gözlem | Öneride kullan, karar öncesi insana bildir |
| **3** | Doğrulanmış / resmi / ölçülmüş | Serbestçe kullan (yine de kararı insan onaylar) |

### Sık Kullanılan Tipe Özel Alanlar (özet — tam tablo Ek B)
```yaml
# Müşteri
segment:            # yapi-market | usta | muteahhit | bayi | fason
risk_sinifi:        # A | B | C | D | E | F | G | H
limit:              # TL cinsinden kredi limiti
vade:               # gün — ör. 30
bolge:              # pazarcik | turkoglu | adiyaman | kirikhan
torba_marka_tercihi: # MİRFİX | İzomir | Dimaxa | Bilfis
son_siparis:        # YYYY-MM-DD (uyuyan müşteri sorgusu bunu kullanır)

# Sipariş / Sevkiyat
tutar: ; ambalaj: ; palet_sayisi: ; termin: ; stok_teyit: ; plaka:

# Tahsilat
bakiye: ; vade_tarihi: ; soz_verilen_tarih: ; tahsil_durumu:

# Ürün
mfx_kod: ; marka: ; kategori: ; birim_agirlik: ; raf_omru:

# Görev / Proje
rol: ; oncelik: ; bitis: ; kilometre_tasi:
```

> **Kural:** Alan adları asla Türkçe karakter içermez (YAML/Dataview uyumu için `bolge`, `vade_tarihi`); değerler Türkçe olabilir. Tam ve otoriter alan listesi `99.1_Sozlukler/Ek_B_YAML_Sozlugu.md` içindedir; bu blueprint onu referanslar.

---

## 2.5 Etiket Mimarisi

Etiketler **kesişimsel filtre** içindir (klasör "nerede", etiket "hangi özellik"). Tümü **hiyerarşik** (`/`) ve **küçük harf, Türkçe karaktersiz**.

### İzinli Etiket Kökleri
```
#tip/            → #tip/musteri #tip/ziyaret #tip/siparis #tip/atom #tip/moc ...
#durum/          → #durum/acik #durum/beklemede #durum/kapandi #durum/riskli
#bolge/          → #bolge/pazarcik #bolge/turkoglu #bolge/adiyaman #bolge/kirikhan
#urun/           → #urun/mfx-320 #urun/su-yalitim #urun/derz ...
#musteri-sinifi/ → #musteri-sinifi/a ... #musteri-sinifi/h
#kanal/          → #kanal/saha #kanal/whatsapp #kanal/telefon #kanal/bayi #kanal/fason
#marka/          → #marka/mirfix #marka/izomir #marka/dimaxa #marka/bilfis
```

### Hiyerarşi Kuralı
- Her etiket **iki seviyelidir**: `kök/deger`. Üç seviye yalnızca ürün alt-kırılımında serbesttir (`#urun/su-yalitim/membran`).
- Bir nota **aynı kökten yalnızca bir değer** verilir (bir müşteri tek bölgeye). İstisna: `#urun/` (bir ziyarette birden çok ürün konuşulabilir).

### Yasaklı Etiket Kuralları
1. **Kök-suz etiket yasak.** `#acil`, `#onemli` gibi serbest etiketler kullanılmaz — hepsi bir köke bağlanır (`#durum/riskli`).
2. **Türkçe karakter yasak.** `#bölge/türkoğlu` DEĞİL → `#bolge/turkoglu`.
3. **Kişi adı etiketi yasak.** Kişiler etiket değil `[[wiki-link]]` ile bağlanır.
4. **Tarih etiketi yasak.** Tarih YAML `tarih:` alanında; etiket değil.
5. **Durum çoğaltma yasak.** Durum hem `durum:` YAML alanında hem `#durum/` etiketinde ise, **YAML SSOT'tur**; etiket yalnızca Graph görünürlüğü içindir ve Templater bunu YAML'dan türetir.

---

## 2.6 Şablon Kütüphanesi (24 Şablon)

Konum: `99_SISTEM/Templates/`. Hepsi gerçek Templater sözdizimi (`<% tp.date.now("YYYY-MM-DD") %>`, `<% tp.file.title %>`) ve YAML iskeleti içerir. Aşağıda **amaç + alan seti özeti**; dosyaların kendisi ayrıca yazılmıştır.

| # | Dosya | Amaç | Kilit alanlar |
|---|---|---|---|
| 01 | `01_Musteri.md` | Yeni müşteri kartı açmak | segment, risk_sinifi(A-H), limit, vade, bolge, torba_marka_tercihi, son_siparis |
| 02 | `02_Ziyaret.md` | Saha ziyareti (MRF-SAT-MZF eş) | musteri, bolge, gorusulen_kisi, konu, sonuc, sonraki_adim, numune |
| 03 | `03_Toplanti.md` | İç/dış toplantı tutanağı | katilimcilar, gundem, kararlar, aksiyonlar |
| 04 | `04_Gunluk_Not.md` | Günlük log (sabah/akşam ritüeli) | sabah_plan, aksam_ozet, oncelikler |
| 05 | `05_Siparis.md` | Sipariş kaydı (SIP eş) | musteri, urunler, tutar, ambalaj, palet_sayisi, termin, stok_teyit |
| 06 | `06_Tahsilat_Gorusmesi.md` | Tahsilat görüşmesi | musteri, bakiye, vade_tarihi, soz_verilen_tarih, tahsil_durumu |
| 07 | `07_Karar.md` | Kurumsal karar kaydı | karar_no, baglam, secenekler, karar, sorumlu |
| 08 | `08_Rakip_Karti.md` | Rakip istihbaratı | rakip_marka, urun_karsiligi, fiyat_konumu, guclu, zayif |
| 09 | `09_Urun.md` | Ürün TDS/kartı | mfx_kod, marka, kategori, birim_agirlik, raf_omru, ambalaj |
| 10 | `10_Sikayet.md` | Müşteri şikâyeti | musteri, urun, sikayet_tipi, koklu_neden, cozum, durum |
| 11 | `11_Proje.md` | Proje çatısı (PARA-P) | hedef, sorumlu, bitis, kilometre_tasi, durum |
| 12 | `12_Tedarikci.md` | Tedarikçi kartı | tedarik_kalemi, sartlar, odeme_vade, iletisim |
| 13 | `13_Bayi.md` | Bayi kartı | bolge, limit, vade, hedef, stok_taahhut |
| 14 | `14_Personel.md` | Personel kartı | rol, gorevler, bolge, hedef |
| 15 | `15_Uretim_Gunlugu.md` | Vardiya üretim log | vardiya, urun, uretilen_miktar, hammadde_tuketim, fire |
| 16 | `16_Icerik_Atomu.md` | Pazarlama içerik atomu | kanal, hedef_kitle, mesaj, guven, onay |
| 17 | `17_Teklif.md` | Teklif kaydı | musteri, kalemler, tutar, gecerlilik, sonuc, kayip_nedeni |
| 18 | `18_Sevkiyat.md` | Sevkiyat/lojistik | siparis, plaka, bolge, palet_sayisi, cikis, teslim |
| 19 | `19_Fatura.md` | Fatura kaydı | musteri, fatura_no, tutar, kdv, vade_tarihi |
| 20 | `20_Gorev.md` | Tekil görev | rol, oncelik, bitis, bagli_kayit |
| 21 | `21_Iade.md` | İade kaydı | musteri, urun, miktar, iade_nedeni, karar |
| 22 | `22_Referans_Uygulama.md` | Saha referans/uygulama | bolge, urun, uygulama_tipi, foto, izin |
| 23 | `23_Bilgi_Atomu.md` | Genel bilgi atomu | iddia, kaynak, guven, konu_moc |
| 24 | `24_MOC_Harita.md` | Harita notu | kapsam, alt_konular, canli_sorgu |

---

## 2.7 Dataview Sorgu Kütüphanesi (25 Sorgu)

Konum: `99_SISTEM/Sorgular/`. 4 dosyada gruplanır. Aşağıda amaç özetleri; çalışan ```dataview blokları dosyaların içinde.

**`Tahsilat_Sorgulari.md` (6):** 1) Vadesi geçenler bugün aranacak, 2) 7 gün içinde vadesi dolacaklar, 3) Söz verilen tarihi geçmiş tahsilatlar, 4) Riskli sınıf (F-H) açık bakiye, 5) Bölge bazlı toplam alacak, 6) Bu ay tahsil edilen özeti.

**`Satis_CRM_Sorgulari.md` (9):** 7) Açık siparişler termine göre, 8) Stok teyidi bekleyen siparişler, 9) Bekleyen numuneler (15 gün kuralı), 10) Bu hafta ziyaret edilmeyen A-sınıfı müşteriler, 11) Uyuyan müşteriler (60 gün sipariş yok), 12) Bu ay kaybedilen teklifler + nedeni, 13) Açık teklifler (geçerlilik yaklaşan), 14) Bölge bazlı ziyaret yoğunluğu, 15) Açık şikâyetler kök nedene göre.

**`Uretim_Kalite_Sorgulari.md` (5):** 16) Bugünkü üretim vardiya özeti, 17) Fire oranı yüksek partiler, 18) Fason iş emirleri açık, 19) Bekleyen kalite testleri, 20) Hammadde (çimento/kum) düşük stok uyarısı.

**`Sistem_Bakim_Sorgulari.md` (5):** 21) Yetim notlar (bağlantısız), 22) Kırık bağlantılar, 23) 3-bağlantı kuralını ihlal edenler, 24) Açık görevler role göre, 25) INBOX'ta 7 günden eski bekleyenler.

---

## 2.8 Tasks Sistemi

MİRFİX, obsidian-tasks eklentisini kullanır. Görevler **hem kayıt notlarının içinde** (bağlamında) yaşar hem de `20_Gorev.md` şablonuyla bağımsız not olabilir.

### Sözdizimi
```markdown
- [ ] Vadesi geçen İbrahim Cam bakiyesini ara 📅 2026-07-05 ⏫ #gorev/tahsilat @Ahmet [[52.19_Tahsilat_Gorusme_IbrahimCam]]
- [ ] MFX-320 numune sonucunu müşteriye ilet ⏳ 2026-07-08 🔼 #gorev/satis @Mehmet
- [x] Pazarcık deposu palet sayımı ✅ 2026-07-04 #gorev/uretim @Depo
```

### Öncelik
| Simge | Anlam |
|---|---|
| 🔺 | En yüksek (tahsilat riski F-H, üretim durması) |
| ⏫ | Yüksek (vadesi bugün, A-sınıfı müşteri) |
| 🔼 | Orta |
| (yok) | Normal |
| 🔽 | Düşük |

### Tarih Simgeleri
`📅` bitiş (due), `⏳` başlanmalı (scheduled), `🛫` başlangıç (start), `🔁` tekrar (recurring), `✅` tamamlanma.

### Tekrar Eden Görev
```markdown
- [ ] Haftalık INBOX sıfırlama 🔁 every week on Monday 📅 2026-07-06 #gorev/bakim @AhmetOfis
- [ ] Aylık kırık bağlantı taraması 🔁 every month on the 1st 📅 2026-08-01 #gorev/bakim @AI-KOS
- [ ] Bölge saha turu (Pazarcık) 🔁 every 2 weeks 📅 2026-07-07 #gorev/satis @Mehmet
```

### Rol Ataması
`@Kisi` etiketi ile atanır; roller: `@Ahmet` (yönetim/finans), `@Mehmet` (saha satış), `@Depo` (sevkiyat), `@Uretim`, `@AI-KOS` (ajan önerisi). Görev `#gorev/<alan>` etiketiyle alanlaşır. Sorgu 24 görevleri role göre listeler.

---

## 2.9 Canvas Kullanım Standardı

Canvas **düşünme ve ilişki görselleştirme** aracıdır; **SSOT değildir** — her canvas kartı bir nota link olmalıdır, ham veri barındırmaz.

Standart canvas'lar:
- `99_SISTEM/Dashboards/Bolge_Haritasi.canvas` — 4 bölge (Pazarcık/Türkoğlu/Adıyaman/Kırıkhan) coğrafi kümeleme, her bölge müşteri notlarına link.
- `80_PROJELER/<proje>.canvas` — proje kilometre taşları akışı.
- `40_SATIS_OPERASYON/Satis_Hunisi.canvas` — aday → ziyaret → teklif → sipariş akışı, kart = gerçek nota link.

**Kurallar:** 1) Kart ham metin değil, not embed'i (`![[not]]`) veya link olmalı. 2) Canvas ayda bir gözden geçirilir; kopuk kart temizlenir. 3) Karar/veri asla yalnızca canvas'ta yaşamaz.

---

## 2.10 Günlük / Toplantı / Proje Ritüelleri

### Sabah 5 Dakika (08:30)
1. `04_Gunluk_Not` şablonundan günlük notu aç (`Ctrl+N` → Templater).
2. `Dashboards/Gunluk_Panel` aç → bugün aranacak (vadesi geçen), açık termin, bekleyen numune sorgularını gör.
3. Günün 3 önceliğini `sabah_plan` alanına yaz, görevlere `📅 bugün` ata.

### Akşam 5 Dakika (18:00)
1. Günlük notta `aksam_ozet` doldur: ne oldu, ne kaldı.
2. INBOX'a düşen saha notlarını hızlıca etiketle (tam işleme haftalık).
3. Tamamlanan görevleri `✅` işaretle; yarına devir olanları `⏳ yarın` yap.

### Toplantı Ritüeli
- Her toplantı `03_Toplanti` şablonuyla açılır; **her karar ayrıca `07_Karar` notuna çıkarılır** (SSOT).
- Aksiyonlar toplantı notunda görev satırı olarak (`- [ ] ... @kisi 📅`) yazılır.

### Proje Ritüeli
- Proje `11_Proje` ile açılır, `80_PROJELER/80.1_Aktif`e konur.
- Haftalık proje check-in: kilometre taşı durumu güncellenir; biten proje `durum: tamamlandi` + çeyreklik arşiv.

---

## 2.11 Vault-içi Dashboard Notları (B6 Uygulaması)

Konum: `99_SISTEM/Dashboards/`. Her dashboard bir MOC'un canlı, Dataview'lu türevidir — B6 ilkesi: "kontrol paneli vault içinde yaşar, dışarı çıkmaz."

| Dashboard | İçerdiği sorgular |
|---|---|
| `Gunluk_Panel.md` | Bugün aranacak (S1), açık termin (S7), bekleyen numune (S9), açık görev @ben (S24) |
| `Tahsilat_Panel.md` | S1–S6 tümü + bölge alacak grafiği |
| `Satis_CRM_Panel.md` | S7–S15 (uyuyan müşteri, A-sınıf ihmal, kayıp teklif) |
| `Uretim_Panel.md` | S16–S20 (vardiya, fire, fason, kalite, hammadde) |
| `Sistem_Sagligi.md` | S21–S25 (yetim, kırık bağlantı, 3-bağlantı ihlali, INBOX yaşı) |

Her dashboard başında güncelleme zamanı: `> Son bakış: <% tp.date.now("YYYY-MM-DD HH:mm") %>` ve ilgili MOC'a link bulunur.

---

## 2.12 Eklenti Politikası

**Çekirdek 7 eklenti** (bunun dışı yönetim onayı ister). Araç-bağımsızlık ilkesi gereği hiçbir eklenti veriyi kilitlemez — kaldırılınca notlar düz metin olarak okunabilir kalır.

| # | Eklenti | Rol | Sabitlenen sürüm |
|---|---|---|---|
| 1 | **Templater** | Şablon motoru (24 şablon) | 2.x — `1.16.x` sabit |
| 2 | **Dataview** | Sorgu/dashboard | `0.5.x` sabit |
| 3 | **Tasks** | Görev sistemi | `7.x` sabit |
| 4 | **Calendar** | Günlük not navigasyonu | `1.5.x` sabit |
| 5 | **Kanban** | Satış hunisi / proje panosu | `1.5.x` sabit |
| 6 | **Excalidraw** | El çizimi / şema | `2.x` sabit |
| 7 | **Obsidian Git** | AI-KOS senkron, otomatik commit | `2.x` sabit |

**Sürüm sabitleme kuralı:** Eklentiler otomatik güncellenmez. Sürümler `99.9_Meta/Eklenti_Surumleri.md` içinde kayıtlıdır; güncelleme çeyreklik bakımda, test vault'ta denendikten sonra yapılır. Git otomatik commit aralığı: 10 dk (saha kaybını önlemek için).

---

## 2.13 Mobil Senaryolar

Saha ekibi telefonla Obsidian mobil kullanır. Hedef: **düşük sürtünme yakalama**, sınıflandırma sonra.

### Senaryo A — Sahada 60 sn müşteri notu
1. Ana ekranda Obsidian widget → "Yeni not".
2. `02_Ziyaret` şablonunu seç (mobil quick-action) → `musteri`, `konu`, `sonraki_adim` doldur (sesle dikte serbest).
3. Not `00_INBOX/00.01`e düşer; ofiste haftalık işlemede `40.1_Ziyaretler`e taşınır ve müşteri notuna bağlanır.

### Senaryo B — Fotoğrafla yakalama
1. Uygulama içi kamera → çekilen foto `00_INBOX/00.02_Foto_Yakalama`e gömülür.
2. Alt satıra tek cümle bağlam: "Kırıkhan villa, MFX-510 uygulaması, izin var".
3. Ofiste `22_Referans_Uygulama` notuna dönüştürülür (`izin: evet` işaretlenir).

**Mobil kurallar:** Sahada bağlantı kurma zorunluluğu yok (INBOX affeder); ama tarih ve müşteri adı mutlaka girilir. Git mobilde manuel push (gün sonu).

---

## 2.14 Bakım Rutinleri + Uygulama Kontrol Listesi

### Haftalık — INBOX Sıfırlama (Pazartesi, 20 dk, @Ahmet)
- `00_INBOX` altındaki her not: sil / bir kayıt notuna dönüştür / ilgili klasöre taşı.
- Taşınan her not **3-bağlantı kuralına** getirilir.
- Hedef: hafta sonu INBOX **boş**.

### Aylık — Kırık Bağlantı + Yetim Tarama (Ayın 1'i, 30 dk, @AI-KOS + insan onay)
- Sorgu 22 (kırık bağlantı) ve 21 (yetim not) çalıştırılır.
- Kırık link'ler düzeltilir; yetim notlar bir MOC'a bağlanır ya da arşivlenir.
- Etiket sözlüğü dışı (yasaklı) etiketler tespit edilip düzeltilir.

### Çeyreklik — Arşiv + Sürüm (Çeyrek başı, 1 saat, @Ahmet)
- `durum: tamamlandi/kapandi` kayıtlar `90_ARSIV`e taşınır (bağlantılar korunur).
- Eski fiyat listeleri arşivlenir, yeni MFX fiyat seti yayınlanır.
- Eklenti sürümleri gözden geçirilir (test vault'ta), `99.9_Meta` güncellenir.
- Bu blueprint sürüm kontrolü (`surum:` artışı gerekiyorsa).

### UYGULAMA KONTROL LİSTESİ
- [ ] `MIRFIX-OS` vault'u oluşturuldu, Git repo `mirfix-os` bağlandı.
- [ ] 11 kök klasör (00–99) JD adlarıyla açıldı.
- [ ] 7 çekirdek eklenti kuruldu ve sürümleri `99.9_Meta`da sabitlendi.
- [ ] 24 şablon `99_SISTEM/Templates`e yerleşti, Templater klasör yolu ayarlandı.
- [ ] 25 Dataview sorgusu `99_SISTEM/Sorgular` 4 dosyasında çalışıyor.
- [ ] 5 dashboard notu `99_SISTEM/Dashboards`te render oluyor.
- [ ] YAML zorunlu alanlar + `guven` sözlüğü `99.1_Sozlukler`de (Ek B).
- [ ] Etiket kökleri (6 kök) tanımlı, yasaklı etiket kuralı ekibe duyuruldu.
- [ ] Günlük/haftalık/aylık/çeyreklik ritüel görevleri (tekrar eden) oluşturuldu.
- [ ] Mobil quick-action (Ziyaret + Foto) saha ekibinde kurulu.
- [ ] İlk 10 gerçek müşteri kartı + 5 ürün kartı örnek olarak girildi (3-bağlantı doğrulandı).

---

> **Bağlantılar:** [[MRF-OS-01_Genel_Cerceve]] · [[MRF-OS-03_AI_KOS_Entegrasyon]] · [[99.1_Sozlukler/Ek_B_YAML_Sozlugu]] · [[99_SISTEM/Dashboards/Sistem_Sagligi]]
