---
tip: blueprint-bolum
kod: MRF-OS-01
baslik: "Dijital Omurga"
surum: v1.0
tarih: 2026-07-05
sahip: CEO (Kurucu Ortak)
durum: onaylandi
alan: OS
etiketler: [omurga, veri-akisi, karar, yetki, guvenlik, surum, dokuman]
---

# BÖLÜM 1 — DİJİTAL OMURGA

> Bu bölüm, [BÖLÜM 0](MRF-OS-00_Giris_Ilkeler_Envanter.md)'da tanımlanan ilkelerin **araçlardan bağımsız uygulama katmanıdır**. Burada anlatılan hiçbir şey belirli bir yazılıma bağlı değildir; Obsidian, n8n veya Drive birer "fiş"tir. Omurga, fişler değişse de yerinde kalır.

---

## 1.1 Bilginin Yaşam Döngüsü

Her bilgi parçası altı aşamalı bir döngüden geçer:

```
YAKALA → SINIFLA → İŞLE → BAĞLA → ARŞİVLE → İMHA
```

### Yakalama Kanal Envanteri ve Kayıt Kuralı

| Kanal | Ne Yakalanır | Kayıt Kuralı | Hedef |
|---|---|---|---|
| WhatsApp "Mirfix sipariş" grubu | Sipariş talepleri | Her sipariş bir INBOX kaydına dönüşür (WF-01) | 00_INBOX |
| WhatsApp finans / kasa icmal fotoğrafları | Günlük kasa, tahsilat fotoğrafı | Fotoğraf + OCR künyesi (WF-06) | 00_INBOX |
| Telefon | Sözlü sipariş / şikâyet / söz | Görüşme sonrası **derhal** not (İlke 3: yazılmayan yok hükmünde) | 00_INBOX |
| Saha (satış/sevkiyat) | Ziyaret, teslim, tahsilat | Saha formu / fotoğraf | 00_INBOX |
| E-posta | Teklif, fatura, resmi yazışma | E-posta arşivlenir + künye çıkarılır | 00_INBOX |

**Kural (İlke 5 — Önce Yakala):** Format mükemmel olmasa da bilgi önce ham haliyle 00_INBOX'a düşer. Kayıp, dağınıklıktan beterdir.

### 00_INBOX Disiplini ve 24 SAAT KURALI

- 00_INBOX, yakalanan her şeyin **tek giriş kapısıdır**. Sınıflanmamış her kayıt burada bekler.
- **24 SAAT KURALI:** Hiçbir kayıt INBOX'ta 24 saatten fazla sınıflanmamış kalamaz. Her iş günü başında sahip rol INBOX'u boşaltır ("inbox zero").
- INBOX'ta 24 saati aşan kayıt, dashboard'da **kırmızı uyarı** üretir (İlke 8: ölçülmeyen yönetilmez).

### Sınıflandırma Karar Ağacı

```
INBOX kaydı geldi
│
├─ Para/taahhüt içeriyor mu?
│   ├─ EVET → FIN alanı · ilgili müşteri/cari kaydına bağla · onay kapısına yönlendir
│   └─ HAYIR ↓
├─ Sipariş mi?
│   ├─ EVET → SAT alanı · WF-01 · müşteri + ürün + fiyat kaydına bağla
│   └─ HAYIR ↓
├─ Üretim/hammadde/fason mı?
│   ├─ EVET → URT alanı · reçete/parti kaydına bağla
│   └─ HAYIR ↓
├─ Kişisel veri mi (KVKK)?
│   ├─ EVET → "Kişisel" sınıfı · erişim kısıtlı · imha takvimine ekle
│   └─ HAYIR ↓
└─ Genel bilgi/referans → ilgili alan klasörüne · en az 3 bağlantı (İlke 7)
```

### İşle, Bağla

- **İşle:** Ham kayıt, standart şablona (frontmatter + gövde) dönüştürülür; eksik alanlar tamamlanır.
- **Bağla (İlke 7):** Her işlenmiş kayıt en az **3 bağlantı** alır. Örn. bir sipariş → müşteri kaydı + ürün kaydı + sevkiyat kaydı.

### Arşiv / İmha Politikası

| Kayıt Tipi | Saklama Süresi | Sonrası |
|---|---|---|
| Fatura / mali belge | **10 yıl** (yasal) | `_ARSIV/` soğuk saklama |
| Sözleşme | Süre + 10 yıl | `_ARSIV/` |
| Sipariş / sevkiyat kaydı | 5 yıl | `_ARSIV/` |
| Kişisel veri (KVKK) | Amaç bitince / azami yasal süre | **İmha** (silme/anonimleştirme, imha tutanağı) |
| Ham INBOX çöpü | Sınıflama sonrası | Temizlenir |

**KVKK imhası:** Kişisel veri, işleme amacı ortadan kalktığında veya azami saklama süresi dolduğunda **imha edilir** (silinir / yok edilir / anonimleştirilir) ve imha kaydı tutulur (bkz. [§1.5](#15-bilgi-güvenliği)).

---

## 1.2 Veri Akış Mimarisi

### Ana Akış

```
KANAL → n8n → (Drive + Vault) → AGENT → DASHBOARD → KARAR → yeni GÖREV → KANAL
```

Bilgi kanaldan girer, n8n ile yapılandırılır, hem dosya (Drive) hem düz metin (Vault) olarak saklanır, agent tarafından okunur, dashboard'da görünür, karara dönüşür ve yeni bir görev olarak kanala geri döner (kapalı döngü — bkz. [B0 §0.7](MRF-OS-00_Giris_Ilkeler_Envanter.md)).

### Altın Kayıt (Golden Record) İlkesi ve Kaynak Öncelik Tablosu

Bir varlık (müşteri, ürün, cari) hakkında bilgi birden çok kanaldan gelebilir. **Golden Record**, bu parçaların birleştirilmiş, çelişkisiz, yetkili tek kaydıdır (İlke 1 uygulaması). Çelişki durumunda hangi kaynağın kazanacağı önceden bellidir:

| Bilgi | Yetkili Kaynak (Kazanan) | İkincil Kaynak |
|---|---|---|
| Ürün fiyatı | MFX Fiyat Listesi (onaylı sürüm) | WhatsApp sözlü teklif (geçersiz) |
| Müşteri kredi limiti | Risk Matrisi (A–H) | Satışçının kanaati |
| Cari bakiye | Muhasebe programı + mutabakat (WF-04) | Kasa fotoğrafı (geçici) |
| Sipariş içeriği | Onaylanmış SIP kaydı | WhatsApp mesajı (ham) |
| Ürün reçetesi | URT reçete kaydı (onaylı) | Üretim notu |

**Kural:** İki kaynak çelişirse, tablo yukarıdan aşağıya kazananı belirler. Golden Record güncellenir, ikincil kaynak "kaynak" olarak işaretlenir.

### Git Tabanlı Vault Sync ve Çakışma Çözüm Protokolü

Vault, aynı zamanda bir **Git deposudur**. Her önemli değişiklik commit'lenir; bu, sürüm geçmişi ve yedekleme sağlar (İlke 9 + 3-2-1).

**Çakışma (merge conflict) çözüm protokolü:**

1. İki kişi/agent aynı dosyayı aynı anda değiştirdiyse Git çakışma işaretler.
2. **Kural:** Otomatik birleştirme (auto-merge) yalnızca çakışmasız dosyalarda yapılır.
3. Çakışan dosyada **insan hakem** karar verir (agent asla çakışmayı tek başına kapatmaz — İlke 4).
4. Golden Record kuralına göre yetkili kaynak kazanır; kaybeden sürüm commit mesajında not edilir.
5. Çözülen dosya `[cakisma-cozuldu]` etiketiyle işaretlenir.

### Çevrimdışı Senaryo

Bir araç (n8n, Drive, internet) kesildiğinde iş durmaz:

| Kesilen | Yedek Prosedür |
|---|---|
| n8n (otomasyon) | Yakalama **manuel** yapılır: mesaj/fotoğraf elle 00_INBOX'a; akışlar geri gelince toplu işlenir |
| İnternet / Drive | Vault yerelde çalışır (Obsidian offline); bağlantı gelince Git push/sync |
| WhatsApp | Telefon + e-posta yedek kanal; sipariş yine INBOX'a yazılır |
| Muhasebe programı | Cari bakiye geçici olarak son mutabakattan (WF-04) okunur |

**İlke:** Hiçbir araç, kesildiğinde şirketi durduramaz. Düz metin + insan, her zaman son yedektir.

---

## 1.3 Karar Akış Mimarisi

### Karar Tipolojisi

| Tip | Ufuk | Örnek | Kim |
|---|---|---|---|
| **Operasyonel** | Saatler–günler | Bugünkü sevkiyat sırası, tek sipariş onayı | Rol sahibi + agent önerisi |
| **Taktik** | Haftalar–aylar | Bir müşteriye sevkiyat blokajı, fason kabul | Rol sahibi + CEO bilgisi |
| **Stratejik** | Aylar–yıllar | Fiyat politikası, yeni ürün, bayi programı | CEO (CEO Engine desteğiyle) |

### RACI Matrisi — 12 Kritik Karar

**R**=Sorumlu (yapan), **A**=Onaylayan (nihai hesap veren), **C**=Danışılan, **I**=Bilgilendirilen. Roller için bkz. [§1.4](#14-yetki-ve-rol-yapısı).

| # | Karar | CEO | Satış | Üretim | Kasa/Finans | Depo-Sevk. | AI Agent |
|---|---|---|---|---|---|---|---|
| 1 | Ürün fiyatı belirleme | A | R | C | C | I | C (öneri) |
| 2 | Müşteri kredi limiti | A | C | I | R | I | C |
| 3 | Vade tanımlama | A | R | I | C | I | C |
| 4 | Sevkiyat blokajı (borç) | I | C | I | A/R | R | C (uyarı) |
| 5 | Sevkiyat serbestisi | I | R | I | A | R | C |
| 6 | Fason iş kabulü | A | C | R | C | I | C |
| 7 | Üretim planı / öncelik | I | C | A/R | I | C | C |
| 8 | Hammadde alımı (çimento+kum) | A | I | R | C | I | C |
| 9 | İade / iskonto kabulü | A | R | C | C | I | C |
| 10 | Yeni müşteri açılışı | I | R | I | A | I | C (risk skoru) |
| 11 | Ödeme talimatı (banka) | A | I | I | R | I | — |
| 12 | Sözleşme imzası | A | R | C | C | I | C (taslak) |

### Karar Defteri Standardı

Taktik ve stratejik her karar bir **Karar Defteri** kaydına yazılır (İlke 3 + İlke 9). Standart yapı:

```
## Karar No: MRF-OS-KRR-YYYY-NNN
- **Durum:** (Hangi problem/fırsat? Bağlam nedir?)
- **Kanıt:** (Hangi veri/rapor/KPI? Kaynak link — en az 3 bağlantı)
- **Seçenekler:** (Değerlendirilen 2-3 alternatif, artı/eksi)
- **Karar:** (Ne kararlaştırıldı? Kim onayladı — A rolü)
- **Sonuç:** (Beklenen etki + gerçekleşen etki, sonradan doldurulur)
```

Karar Defteri, kurumsal hafızanın çekirdeğidir (bkz. [§1.8](#18-kurumsal-hafıza-i̇lkeleri--bölüm-uygulama-kontrol-listesi)).

---

## 1.4 Yetki ve Rol Yapısı

> **Temel kural (İlke 10):** Yetki **kişiye değil role** verilir. Kişi ayrılırsa rol devredilir, sistem çalışmaya devam eder.

### Rol Kataloğu

| Rol | Sorumluluk Alanı | Mevcut Taşıyıcı (örnek) |
|---|---|---|
| **CEO** | Strateji, fiyat/limit onayı, anayasa | Kurucu Ortak |
| **Satış Sorumlusu** | Teklif, sipariş, müşteri ilişkisi | *Ferhat B. rolü* |
| **Üretim Sorumlusu** | Reçete, fason, ambalaj, hammadde | (atanacak) |
| **Kasa / Finans** | Tahsilat, ödeme, cari, risk | (atanacak) |
| **Depo–Sevkiyat** | Stok, yükleme, sevk planı | (atanacak) |
| **Şoförler** | Teslimat, saha tahsilat (kısıtlı) | ~46 plaka filo |
| **Dış Muhasebe** | Resmi defter, beyanname, e-fatura | Dış hizmet |
| **AI Agent'lar (KOS)** | Analiz, taslak, uyarı, öneri | Claude/KOS |

### Erişim Matrisi (özet)

| Kayıt Alanı | CEO | Satış | Üretim | Finans | Depo | Şoför | AI |
|---|---|---|---|---|---|---|---|
| Fiyat listesi (yaz) | ✎ | oku | oku | oku | oku | — | öneri |
| Risk matrisi | ✎ | oku | — | ✎ | — | — | oku |
| Cari / bakiye | oku | oku | — | ✎ | — | — | oku |
| Sipariş kayıtları | oku | ✎ | oku | oku | oku | oku(kısıtlı) | ✎taslak |
| Üretim/reçete | oku | — | ✎ | — | oku | — | oku |
| Karar Defteri | ✎ | ✎ | ✎ | ✎ | ✎ | — | ✎taslak |
| Kişisel veri (KVKK) | oku | kısıtlı | — | kısıtlı | — | — | maskeli |

(✎ = yazma yetkisi, oku = okuma, — = erişim yok)

### İnsan-Onay Kapıları: AI'ın Asla Tek Başına Geçemeyeceği 9 KAPI

İlke 4'ün ("AI önerir, insan onaylar") somut uygulaması. AI agent bu 9 karardan hiçbirini **tek başına yürürlüğe koyamaz**; mutlaka yetkili insan rolünün onayı gerekir.

| Kapı # | Karar | AI Ne Yapabilir | Onaylayan Rol (İnsan) |
|---|---|---|---|
| **K1** | Fiyat belirleme / değiştirme | Öneri, hesaplama, rakip analizi | CEO |
| **K2** | Kredi limiti tanımlama / artırma | Risk skoru, geçmiş analiz | CEO / Kasa-Finans |
| **K3** | Sevkiyat serbest bırakma (borçlu müşteri) | Uyarı, bakiye kontrolü | Kasa-Finans |
| **K4** | İade / iskonto kabulü | Taslak, gerekçe özeti | CEO / Satış |
| **K5** | Sözleşme onayı / imza | Taslak metin üretimi | CEO |
| **K6** | Ödeme talimatı (banka çıkışı) | Liste hazırlama, mutabakat | Kasa-Finans |
| **K7** | Yeni müşteri / cari açılışı | Risk sınıflandırma | Kasa-Finans |
| **K8** | Fason iş kabulü / reçete değişikliği | Kapasite/maliyet analizi | Üretim / CEO |
| **K9** | Hammadde / büyük satın alma | Fiyat karşılaştırma | CEO |

> **Kural:** Bu 9 kapının herhangi birinde bir AI çıktısı doğrudan uygulanırsa, bu bir **sistem ihlalidir** ve olay kaydı açılır (bkz. [§1.5](#15-bilgi-güvenliği) Olay Müdahale).

---

## 1.5 Bilgi Güvenliği

### Veri Sınıflandırması

| Sınıf | Tanım | Örnek | Erişim |
|---|---|---|---|
| **Genel** | Kamuya açık | Ürün broşürü, TDS | Herkes |
| **İç** | Şirket içi | Fiyat listesi, iş akışları | Çalışanlar |
| **Gizli** | Hassas ticari | Maliyet, marj, risk matrisi | Yetkili rol + CEO |
| **Kişisel (KVKK)** | Kişisel veri | Müşteri kimlik/iletişim | Kısıtlı + maskeleme |

### Kimlik ve Cihaz Politikası

- **2FA zorunlu:** Drive, Git, e-posta, kritik hesaplarda iki adımlı doğrulama.
- **Cihaz politikası:** Kritik sistemlere yalnızca ekran kilidi + güncel işletim sistemi olan cihazlardan erişim.
- **İş–kişisel WhatsApp ayrımı:** Sipariş/finans için ayrı iş numarası/hattı; kişisel hesapta şirket verisi tutulmaz.
- **Ayrılan personel prosedürü:** Ayrılışta 24 saat içinde tüm erişimler kapatılır, şifreler döndürülür (rotasyon), rol yeni taşıyıcıya devredilir, cihaz iadesi ve veri temizliği tutanağa bağlanır.

### Yedekleme 3-2-1

- **3 kopya:** Çalışan (yerel Vault) + Drive + soğuk yedek.
- **2 farklı ortam:** Bulut (Drive/Git) + yerel/dış disk.
- **1 dış lokasyon:** Aylık soğuk yedek, ofis dışında (İlke: felaket dayanıklılığı).
- **Çeyreklik restore tatbikatı:** 3 ayda bir yedekten geri yükleme denenir; sadece yedek almak yetmez, **geri dönebildiğini kanıtla**.

### Credential Kasası ve Anahtar Rotasyonu

- Tüm parolalar/API anahtarları bir **şifre kasasında** (parola yöneticisi) tutulur; düz metinde asla saklanmaz.
- API anahtarları ve kritik parolalar **6 ayda bir** veya personel ayrılışında döndürülür.

### KVKK Uyum Paketi

- Veri envanteri (hangi kişisel veri nerede), aydınlatma metni, açık rıza kayıtları, saklama/imha takvimi.
- Kişisel veri en az yetkiyle erişilir; raporlarda maskelenir; süre dolunca imha edilir (§1.1).

### Olay Müdahale Planı — İlk 1 Saat

Bir ihlal/sızıntı/yetkisiz erişim şüphesinde ilk 60 dakika:

1. **0–5 dk:** Olayı tespit eden kişi Kasa/Finans + CEO'ya bildirir; olay kaydı açar.
2. **5–15 dk:** Etkilenen hesap/erişim **derhal kesilir**, şifreler döndürülür.
3. **15–30 dk:** Etkinin kapsamı belirlenir (hangi veri, hangi sınıf, KVKK var mı?).
4. **30–45 dk:** Kanıtlar (log, ekran görüntüsü) korunur; Golden Record'un bütünlüğü kontrol edilir; gerekirse yedekten doğrulanır.
5. **45–60 dk:** Karar Defterine olay yazılır; KVKK ihlali ise yasal bildirim süreci (72 saat) başlatılır; iletişim planı belirlenir.

---

## 1.6 Sürüm ve Değişiklik Yönetimi

### Belge Sürüm Standardı (İlke 9)

- Taslak: **v0.x** → İlk yayın: **v1.0** → Küçük güncelleme: **+0.1** → Büyük revizyon: **+1.0 (v2.0)**.
- Eski sürümler silinmez, `_ARSIV/` altına taşınır.
- `durum` alanı: `taslak` → `gozden-geciriliyor` → `onaylandi`.

### Git Dal / Commit Standardı

| Öğe | Standart |
|---|---|
| Ana dal | `main` (yalnızca onaylı, `durum: onaylandi`) |
| Çalışma dalı | `taslak/<kod>-<konu>` (örn. `taslak/MRF-OS-01-guvenlik`) |
| Commit mesajı | `[KOD] eylem: kısa açıklama` (örn. `[MRF-OS-01] guncelle: 9 kapı tablosu`) |
| Birleştirme | Yalnızca sahip rol onayıyla `main`'e merge |

### Değişiklik Talebi (CR) Mini Süreci

```
1. TALEP  → Kim, neyi, neden değiştirmek istiyor? (CR kaydı)
2. ETKİ   → Hangi belgeler/akışlar etkilenir? (bağlantı analizi)
3. ONAY   → Sahip rol (ve gerekiyorsa CEO) onaylar
4. UYGULA → Taslak dalda değişiklik + sürüm artışı
5. YAYIN  → main'e merge, eski sürüm _ARSIV'e, ilgililer bilgilendirilir (I)
```

Küçük düzeltmeler (yazım vb.) hızlı yolla; para/taahhüt/yetki etkileyen değişiklikler tam CR sürecinden geçer.

---

## 1.7 Doküman Mimarisi

### Kodlama (SAT setiyle geriye uyumlu)

`MRF-[ALAN]-[TİP]-[NO]` — mevcut `MRF-SAT-*` satış seti ve `MFX-*` fiyat kodları **korunur**; yeni belgeler aynı şemaya eklenir (bkz. [B0 §0.9](MRF-OS-00_Giris_Ilkeler_Envanter.md)).

### Drive ↔ Vault Ayna Klasör İskeleti

Aynı iskelet hem Drive'da (dosyalar) hem Vault'ta (Markdown) aynalanır:

```
MİRFİX-OS/
├── 00_INBOX/              ← yakalanan ham veri (24 saat kuralı)
├── 01_OS/                 ← blueprint, ilkeler, karar defteri
├── 02_SAT/                ← satış seti (MRF-SAT-*), teklif/sözleşme
├── 03_URT/                ← üretim, reçete, fason, ambalaj
├── 04_FIN/                ← finans, risk matrisi, mutabakat, nakit akış
├── 05_PZR/                ← pazarlama, ürün veri, bayi
├── 06_IK/                 ← roller, prosedürler
├── 07_IHR/                ← ihracat
├── 08_MUSTERI/            ← müşteri Golden Record'ları
├── 09_URUN/               ← ürün Golden Record'ları (MFX kodları)
├── _SABLON/               ← şablonlar
└── _ARSIV/                ← eski sürümler, saklama süresi dolmuşlar
```

### Dosya Adlandırma Standardı

`MRF-[ALAN]-[TİP]-[NO]_Kisa_Baslik.md` — Türkçe karakter yerine ASCII (ş→s, ç→c...) dosya adında; başlık içeride tam Türkçe. Örn. `MRF-OS-01_Dijital_Omurga.md`.

---

## 1.8 Kurumsal Hafıza İlkeleri + Bölüm Uygulama Kontrol Listesi

### Kurumsal Hafıza İlkeleri (B7'ye Köprü)

Dijital Omurga'nın nihai amacı, şirketin **hafızasını kişilerden kuruma taşımaktır** (İlke 10). Bunun dört taşıyıcısı:

1. **Karar Defteri:** Neden o kararı verdik? (bağlam kaybolmaz)
2. **Sürüm geçmişi (Git):** Ne zaman, neyi değiştirdik?
3. **Golden Record:** Bir varlığın tüm geçmişi tek yerde.
4. **Bağlantı ağı (İlke 7):** Bilgi birbirine bağlı, keşfedilebilir.

Bu dört taşıyıcı, ileride **B7 Kurumsal Hafıza / KOS Zekâ Katmanı**'nın besleneceği kaynaktır. Bugün doğru yazılan her kayıt, yarın AI'ın öğreneceği kurumsal bilgidir.

### Bölüm Uygulama Kontrol Listesi

- [ ] 00_INBOX klasörü Drive ve Vault'ta oluşturuldu, 24 saat kuralı ilan edildi
- [ ] Yakalama kanalları (WhatsApp/tel/saha/e-posta) INBOX'a bağlandı
- [ ] Sınıflandırma karar ağacı ekiple paylaşıldı
- [ ] Golden Record ve kaynak öncelik tablosu onaylandı
- [ ] Vault Git deposu kuruldu, çakışma protokolü test edildi
- [ ] 12 kritik karar için RACI matrisi rollere onaylatıldı
- [ ] Karar Defteri şablonu `_SABLON/` altına eklendi
- [ ] Rol kataloğu dolduruldu, taşıyıcılar atandı
- [ ] 9 Onay Kapısı tablosu ilan edildi, agent'lar bu sınıra göre yapılandırıldı
- [ ] 2FA tüm kritik hesaplarda aktif
- [ ] 3-2-1 yedekleme kuruldu, ilk restore tatbikatı yapıldı
- [ ] Credential kasası kuruldu, rotasyon takvimi belirlendi
- [ ] KVKK veri envanteri ve imha takvimi başlatıldı
- [ ] Olay Müdahale Planı (ilk 1 saat) ekiple paylaşıldı
- [ ] Git dal/commit standardı ve CR süreci ilan edildi
- [ ] Drive↔Vault ayna klasör iskeleti kuruldu

---

## Sizden Beklenen Girdiler

| # | Eksik Bilgi | Neden Gerekli | Sahip | Öncelik |
|---|---|---|---|---|
| 1 | Ekip 5 kişinin rollere kesin ataması | Rol kataloğu ve erişim matrisini kesinleştirmek | CEO | Yüksek |
| 2 | Mevcut Git/Drive kurulum durumu | Sync ve yedekleme adımlarını planlamak | KOS | Yüksek |
| 3 | KOS güven alanı 0-3'ün 9 Kapı ile eşlemesi | AI onay sınırlarını netleştirmek | CEO / KOS | Yüksek |
| 4 | Kullanılan muhasebe programı ve cari erişimi | Golden Record kaynak entegrasyonu | Dış Muhasebe | Orta |
| 5 | Mevcut parola/anahtar yönetimi durumu | Credential kasası ve rotasyon planı | CEO | Orta |
| 6 | KVKK mevcut belgeleri (aydınlatma/rıza) | Uyum paketini tamamlamak | CEO | Orta |
| 7 | Şoför/saha personelinin veri erişim ihtiyacı | Kısıtlı erişim kurallarını netleştirmek | Depo-Sevkiyat | Düşük |

---

*İlgili bölümler:* [BÖLÜM 0 — Giriş, İlkeler ve Envanter](MRF-OS-00_Giris_Ilkeler_Envanter.md)

*Belge sonu — MRF-OS-01 v1.0*
