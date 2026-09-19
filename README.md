# Medentry Filo — Makine ve Araç Takip Platformu

İş makineleri ve araçlar için 4G/GPS takip, kamera, çalışma saati, geofence,
yakıt ve **günlük hakediş** platformu. Telefonda tek ekrandan şunu görürsünüz:

> **Makine nerede → kaçta çalıştı → kaç saat çalıştı → kim kullanıyor →
> görüntü → yakıt/çalışma verisi → günlük hakediş**

Sistem, çalışan izlemenin hukuki boyutunu sonradan eklenen bir politika belgesi
olarak değil, **kodun içine gömülü kısıtlar** olarak ele alır: kabin kamerası
canlı izlenemez, amaç dışı erişim reddedilir, her görüntüleme operatöre
bildirilir. Ayrıntı: [`docs/kvkk/00-uyum-plani.md`](docs/kvkk/00-uyum-plani.md).

---

## İçindekiler

- [Ne yapar?](#ne-yapar)
- [Hızlı başlangıç](#hızlı-başlangıç)
- [Mimari](#mimari)
- [KVKK yaklaşımı](#kvkk-yaklaşımı)
- [Desteklenen donanım](#desteklenen-donanım)
- [Testler](#testler)
- [Belgeler](#belgeler)

---

## Ne yapar?

| Alan | Yetenek |
|------|---------|
| **Konum** | 4G/GPS ile anlık konum, gün izi, hız, yön |
| **Çalışma saati** | Kontak aç/kapa → çalışma oturumu; kısa duraklamaların birleştirilmesi; veri kesintisinde oturumun doğru kapatılması |
| **Rölanti** | İş makinesinde **motor devrinden** (hız sıfır olduğu için), yol aracında hızdan |
| **Geofence** | Şantiye/depo/yasaklı bölge; histerezis ile sınır titremesi önleme; şantiyede geçen süre |
| **Yakıt** | Dolum ve ani düşüş (hırsızlık) tespiti, medyan filtre + güven skoru; saatlik tüketim |
| **Kamera** | 4G cihazlarda canlı izleme ve SD'den geri oynatma; **bağımsız kayıt cihazlarında** olayın SD karttaki zaman aralığını (cihaz saat sapması uygulanmış) gösterme |
| **Cihazsız çalışma** | Takip cihazı yokken elle vardiya başlat/bitir; sensör yokken yakıtı motor saatinden tahmin etme ve fiş girişiyle kalibre etme |
| **Operatör** | Vardiya ataması — "makineyi kim kullanıyor" |
| **Hakediş** | Saatlik / günlük götürü / asgari saat garantili / aylık tarifeler; mesai çarpanı, rölanti tarifesi, nakliye, yakıt, KDV; satır bazlı döküm; onay ve kilit; CSV dışa aktarım |
| **KVKK** | Aydınlatma, teyit, amaçla sınırlılık, mahremiyet pencereleri, denetim kaydı, saklama/imha, ilgili kişi başvuruları, uyum panosu |

## Tek makine / tek kişi kullanıyorsanız

Makineyi kendiniz kullanıyor ve videoyu bağımsız bir kayıt cihazından (SD kart)
alıyorsanız, kurulum tek komuttur:

```bash
OWNER_EMAIL=ben@firmam.com.tr OWNER_PASSWORD='GucluParola123' \
ASSET_CODE=EKS-01 TRACKER_IMEI=<takip-cihazi-imei> \
RECORDER_MODEL='SD kayit cihazi' npm run setup:solo
```

Bu kurulum **tek kullanıcı modunu** açar: izleyen ile izlenen aynı kişi
olduğunda çalışan koruma kuralları uygulanmaz. Makineye başka bir operatör
atandığı anda korumalar o kişi için kendiliğinden geri gelir.

Hangi verinin nereden geldiği, hangi cihazın ne verdiği ve sensörsüz yakıt
takibi: [`docs/tek-makine-kurulum.md`](docs/tek-makine-kurulum.md)

## Hızlı başlangıç

**Gereksinimler:** Node.js ≥ 20.10, PostgreSQL ≥ 14 (veya Docker).

```bash
# 1) Bağımlılıklar
npm install

# 2) Veritabanı (Docker ile)
docker compose up -d postgres

# 3) Ortam değişkenleri
cp .env.example .env     # DATABASE_URL, JWT_SECRET, INGEST_KEY

# 4) Şema + demo veri
npm run db:seed

# 5) Servisler (ayrı terminallerde)
npm run dev:api          # REST API        -> :8080
npm run dev:ingest       # cihaz TCP girişi -> :5023 :5027 :7611, komut :8081
npm run dev:web          # arayüz          -> :5173

# 6) Donanım yokken: gerçek protokol çerçeveleriyle bir iş günü üret
npm run simulate -- --days 2     # geçmiş günleri yükler
npm run simulate -- --live       # anlık yayın
```

Demo kullanıcılar (parola `Medentry2026!`):

| Rol | E-posta |
|-----|---------|
| Firma sahibi | `sahip@ornek-firma.com.tr` |
| Yönetici | `yonetici@ornek-firma.com.tr` |
| Şantiye şefi | `sef@ornek-firma.com.tr` |
| KVKK irtibat kişisi | `kvkk@ornek-firma.com.tr` |
| Operatör | `operator1@ornek-firma.com.tr` |
| Muhasebe (izleyici) | `muhasebe@ornek-firma.com.tr` |

Uçtan uca doğrulama:

```bash
./scripts/smoke.sh       # giriş, dashboard, KVKK kısıtları, hakediş, uyum panosu
```

## Mimari

```
   cihazlar                    ingest                    api                   arayüz
┌──────────────┐          ┌──────────────┐        ┌──────────────┐        ┌────────────┐
│ GPS tracker  │─ TCP ───▶│ protokol     │─ HTTP ▶│ işleme hattı │◀─ REST │ PWA        │
│ (Teltonika)  │  5027    │ çözücü + ack │        │ oturum/fence │        │ tek ekran  │
├──────────────┤          │              │        │ yakıt/alarm  │        └────────────┘
│ GPS tracker  │─ TCP ───▶│              │        ├──────────────┤
│ (GT06)       │  5023    │              │        │ hakediş      │
├──────────────┤          │              │        │ KVKK denetimi│
│ 4G MDVR      │─ TCP ───▶│              │◀───────│ medya komutu │
│ (JT808/1078) │  7611    │ komut kanalı │  8081  └──────────────┘
└──────┬───────┘          └──────────────┘                │
       │ RTP video                                   PostgreSQL
       ▼
  medya geçidi ──HLS──▶ telefon
```

**Paketler**

| Paket | İçerik |
|-------|--------|
| `packages/shared` | Coğrafi/zaman yardımcıları, ortak tipler, amaç→veri matrisi |
| `packages/protocols` | GT06, Teltonika Codec8/8E, JT/T 808 çözücüleri + JT/T 1078 video komutları |
| `packages/domain` | Oturum, geofence, yakıt, hakediş ve **KVKK erişim politikası** motorları (saf fonksiyonlar) |
| `apps/api` | REST API, veritabanı, işleme hattı, periyodik işler |
| `apps/ingest` | Cihaz TCP sunucuları ve kamera komut kanalı |
| `apps/web` | Mobil öncelikli arayüz (tek ekran) |
| `apps/simulator` | Donanımsız uçtan uca deneme |

İş mantığı (`packages/domain`) veritabanı ve saat bağımlılığı olmayan saf
fonksiyonlardır; bu sayede hakediş hesabı geçmişe dönük olarak **aynı girdiden
aynı sonucu** üretir ve itiraz halinde yeniden hesaplanabilir.

Ayrıntı: [`docs/mimari.md`](docs/mimari.md)

## KVKK yaklaşımı

Bu sistem çalışanı izler; dolayısıyla hukuki kurgu teknik kurguyla birlikte
tasarlanmıştır. **Gizli kamera yoktur.**

Kod düzeyinde uygulanan kısıtlar (`packages/domain/src/privacy.ts`):

| Kural | Kod |
|-------|-----|
| Kabin kamerası canlı izlenemez | `CABIN_LIVE_FORBIDDEN` |
| Kabin görüntüsü yalnızca olaya bağlı (±30 sn) | `CABIN_EVENT_REQUIRED` |
| Amaç dışı veriye erişilemez | `PURPOSE_MISMATCH` |
| Operatör aydınlatma metnini teyit etmeden kamera açılmaz | `NOTICE_NOT_ACKNOWLEDGED` |
| Kamera erişiminde yazılı gerekçe zorunlu | `REASON_REQUIRED` |
| Mola / vardiya dışı erişim kapalı | `PRIVACY_WINDOW` |
| Ses kaydı varsayılan kapalı | `no_audio` |
| Her erişim operatöre bildirilir | `notify_operator` |
| Mahremiyet bölgesinde konum gönderilmez | `privacy_zone` geofence |
| Süresi dolan kayıt otomatik imha | `runRetention` |

Operatör, uygulamadan **"verime kim erişti"** ekranıyla kendi kaydını görebilir
(KVKK m.11). Yönetim, uyum panosundan eksikleri görür.

Belge paketi: [`docs/kvkk/`](docs/kvkk/) — aydınlatma metinleri, kamera
politikası, saklama-imha politikası, işleme envanteri, etki değerlendirmesi,
personel tutanağı, sözleşme eki, başvuru formu.

> Belgeler **taslak şablondur**; yayımlamadan önce avukat/KVKK danışmanı
> incelemesi gerekir.

## Desteklenen donanım

| Aile | Protokol | Kullanım |
|------|----------|----------|
| Teltonika FMB/FMC + CAN adaptörü | Codec8 / Codec8E | **İş makinesi** — motor devri, motor saati, yakıt CAN'dan okunur |
| GT06 / GT06N (Concox ve muadili) | GT06 | Ekonomik araç takibi |
| 4G MDVR / kameralı terminal | JT/T 808 + JT/T 1078 | Kamera: canlı yayın, SD geri oynatma, kayıt listesi, dosya yükleme |
| Kendi cihazınız / telefon uygulaması | HTTPS JSON | `POST /api/ingest` |

Seçim rehberi, montaj ve kamera açıları: [`docs/donanim.md`](docs/donanim.md)

## Testler

```bash
npm test          # 150 test (birim + API entegrasyon)
npm run typecheck # tüm workspace
```

- **Birim:** protokol çözücüleri (CRC, parçalı paket, işaretli koordinat),
  oturum motoru, geofence histerezisi, yakıt tespiti, hakediş tarifeleri,
  KVKK politika motoru.
- **Entegrasyon (API):** KVKK kısıtlarının gerçekten uygulandığı, telemetriden
  hakedişe giden zincirin doğru tutar ürettiği. Ayrı bir test veritabanı
  kullanır; PostgreSQL yoksa bu testler atlanır.

## Belgeler

| Belge | İçerik |
|-------|--------|
| [`docs/mimari.md`](docs/mimari.md) | Katmanlar, veri modeli, işleme hattı, ölçekleme |
| [`docs/tek-makine-kurulum.md`](docs/tek-makine-kurulum.md) | **Tek makine:** veri hangi cihazdan gelir, sensörsüz yakıt, kayıt cihazı akışı |
| [`docs/donanim.md`](docs/donanim.md) | Cihaz seçimi, montaj, kamera açıları, SIM ve veri planı |
| [`docs/kurulum.md`](docs/kurulum.md) | Kurulum, ortam değişkenleri, üretime alma, yedekleme |
| [`docs/api.md`](docs/api.md) | REST uç noktaları |
| [`docs/kvkk/`](docs/kvkk/) | Uyum planı ve belge şablonları |

## Lisans

Özel kullanım. Tüm hakları saklıdır.
