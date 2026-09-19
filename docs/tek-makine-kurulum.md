# Tek Makine / Tek Kişi Kurulumu — Veriyi Nereden Çekiyoruz?

Senaryo: makineyi siz kullanıyorsunuz, video bağımsız bir kayıt cihazından
(SD kart) elle alınacak. Geriye kalan soru: **konum, çalışma saati, rölanti,
yakıt ve hakediş verisi nereden gelecek?**

---

## 1. Hangi veri nereden gelir

| Veri | Kaynak | Alternatif (kaynak yoksa) |
|------|--------|---------------------------|
| **Konum, hız, güzergâh** | GPS takip cihazı | Telefon uygulaması (zayıf), yoksa yok |
| **Kontak aç/kapa → çalışma saati** | Takip cihazının **kontak (ACC) kablosu** | Harici voltaj/hareket tahmini; en son çare elle vardiya |
| **Rölanti (motor açık, iş yok)** | CAN'dan motor devri | Cihazın hareket/titreşim sensörü |
| **Motor saati (toplam)** | CAN'dan makinenin kendi sayacı | Kontak süresinin toplamı + makinenin mevcut saati (`hourMeterHours`) |
| **Yakıt seviyesi** | CAN veya kapasitif yakıt sondası | Fiş girişi + beyan edilen lt/saat ile tahmin |
| **Kilometre** | CAN veya GPS mesafesi | GPS mesafesi (zaten hesaplanıyor) |
| **Şantiyeye giriş/çıkış** | GPS + geofence | — |
| **Video** | Bağımsız kayıt cihazı (SD) | — |
| **Hakediş** | Yukarıdakilerden otomatik hesaplanır | — |

**Kritik nokta:** Hakedişin dayanağı çalışma saatidir, çalışma saatinin dayanağı
da **kontak kablosudur**. Tek bir kablo doğru bağlanırsa sistemin %80'i çalışır.

## 2. Üç kurulum seviyesi

### Seviye 1 — Sadece takip cihazı (önerilen başlangıç)

**Ne alınır:** kontak girişli 4G GPS takip cihazı (Teltonika FMB920/FMB003
sınıfı veya GT06N sınıfı ekonomik muadil).

**Bağlantı:** `+12/24V` · `şase` · **kontak (ACC)** · dahili GPS/GSM anten.

**Ne verir:** konum, güzergâh, hız, kontak aç/kapa → **çalışma saati**,
geofence, hareket sensöründen kaba rölanti.

**Ne vermez:** yakıt, motor devri, makinenin kendi motor saati.

```bash
# Makinenin mevcut saat göstergesini bir kez girin: toplam saat doğru görünsün
curl -X PATCH $API/api/assets/<asset-id> -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"hourMeterHours": 4250, "idleStrategy": "movement"}'
```

### Seviye 2 — Takip cihazı + CAN adaptörü

**Ek olarak alınır:** CAN adaptörü (Teltonika LV‑CAN200 / ALL‑CAN300 vb.) ve
CAN destekli bir cihaz gövdesi (FMB640 / FMC650).

**Ne ekler:** motor devri (gerçek rölanti ayrımı), makinenin kendi motor saati,
yakıt seviyesi (%), toplam yakıt tüketimi, soğutma suyu sıcaklığı.

**Şartı:** makinenin CAN hattının okunabilir olması. Eski makinelerde (yaklaşık
2010 öncesi) çoğu zaman yoktur — satın almadan önce makine markası/model yılı
ile adaptör uyumluluk listesine bakın.

```bash
curl -X PATCH $API/api/assets/<asset-id> ... -d '{"idleStrategy": "rpm"}'
```

> CAN'dan gelen IO numaraları firmware'e göre değişir; devreye alırken cihazın
> AVL ID dokümanıyla doğrulayın. Yazılımda eşleme değiştirilebilir
> (`createTeltonikaDecoder({ ioMap: ... })`). Ayrıntı: [`donanim.md`](donanim.md).

### Seviye 3 — Yakıt sondası

CAN yoksa ama yakıt takibi istiyorsanız: tanka **kapasitif yakıt sondası**
takılır, cihazın analog girişine bağlanır ve boş/dolu kalibrasyonu yapılır.
Montaj tankın delinmesini gerektirir.

**Maliyet/fayda:** yakıt hırsızlığı şüpheniz yoksa Seviye 1 + fiş girişi
genellikle yeterlidir (aşağıya bakın).

## 3. Yakıtı sensörsüz takip etmek

Sonda ya da CAN yoksa yakıt şöyle izlenir:

1. **Beyan edilen tüketim:** makinenin ortalama lt/saat değerini girersiniz.
   Sistem, motor saatinden günlük tüketimi tahmin eder ve hakedişe yazar.
2. **Fiş girişi:** her mazot alımını uygulamadan girersiniz
   (Makine ekranı → *Yakıt girişi ekle*).
3. **Kalibrasyon:** sistem, girilen litreyi motor saatine bölüp **gerçek
   lt/saat** değerini hesaplar ve beyan ettiğiniz değerle karşılaştırır.

```bash
# Beyan edilen ortalama tüketim (örnek: 18 lt/saat)
curl -X PATCH $API/api/assets/<asset-id> ... -d '{"nominalConsumptionLph": 18}'

# Gerçek tüketim ve saatlik maliyet
curl "$API/api/assets/<asset-id>/fuel" -H "authorization: Bearer $TOKEN"
# -> summary: { purchasedLiters, engineHours, measuredLitersPerHour, costPerHour }
```

Bir ay sonra ölçülen değer beyan ettiğinizden belirgin farklıysa nominal değeri
güncelleyin; tahmin gerçeğe yaklaşır.

## 4. Kayıt cihazı (video) nasıl bağlanır

Kayıt cihazı platforma **bağlanmaz**. Sistemdeki rolü şudur: olay olduğunda
kaydı SD kartta **hangi saat aralığında arayacağınızı** söylemek.

1. Kayıt cihazını sisteme "manuel" olarak tanıtın (kurulum betiği bunu yapar).
2. Sert fren / çarpma / alarm olduğunda olay listesine düşer.
3. Olaya dokunun → **"Kayıt cihazında ara"** penceresi açılır:
   başlangıç–bitiş saati, cihazın kendi saatine göre kaydırılmış olarak.

**Saat sapmasını bir kez ölçün.** Kayıt cihazlarının saati aylar içinde
dakikalarca kayar. Cihazın ekranındaki saat ile telefonunuzdaki saat arasındaki
farkı saniye cinsinden girin; sistem aralığı otomatik kaydırır:

```bash
# Cihaz saati 95 saniye ileriyse:
curl -X PATCH $API/api/devices/<device-id> -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"clockOffsetSec": 95}'
```

Sapmayı 3–6 ayda bir yeniden ölçmek yeterlidir.

## 5. Donanım gelene kadar: elle vardiya

Takip cihazı tanımlı değilse makine ekranında **"Vardiya (elle)"** kartı çıkar:
işe başlarken *Vardiyayı başlat*, bitirirken *Vardiyayı bitir*. Hakediş bu
süreden hesaplanır. Rölantiyi beyan edebilirsiniz.

Cihaz taktığınız anda kart kendiliğinden kaybolur; çalışma saati otomatik
kontak kayıtlarından üretilmeye başlar.

```bash
curl -X POST $API/api/assets/<asset-id>/sessions/start -H "authorization: Bearer $TOKEN"
curl -X POST $API/api/assets/<asset-id>/sessions/stop  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"idleMinutes": 30}'
```

## 6. Sıfırdan kurulum (tek komut)

```bash
docker compose up -d postgres

OWNER_EMAIL=ben@firmam.com.tr OWNER_PASSWORD='GucluParola123' OWNER_NAME='Adiniz' \
COMPANY_NAME='Firmam' \
ASSET_CODE=EKS-01 ASSET_NAME='Ekskavator' ASSET_TYPE=excavator \
ASSET_MAKE=Caterpillar ASSET_MODEL=320D \
FUEL_TANK_LITERS=410 NOMINAL_LPH=18 HOUR_METER_HOURS=4250 \
HOURLY_RATE=2000 \
TRACKER_IMEI=356307042441013 TRACKER_PROTOCOL=teltonika TRACKER_MODEL=FMB920 \
RECORDER_MODEL='4 kanal SD kayit cihazi' RECORDER_CHANNELS='front,cabin' \
npm run setup:solo
```

Bu komut: firmayı **tek kullanıcı modunda** açar, sizi hem sahip hem operatör
olarak tanımlar, makineyi + tarifeyi + takip cihazını + kayıt cihazını kurar.

Sonra:

```bash
npm run dev:api      # API
npm run dev:ingest   # cihaz bağlantıları (tracker buraya bağlanır)
npm run dev:web      # arayüz
```

Takip cihazını sunucunuzun IP'sine ve protokol portuna yönlendirin:
Teltonika `5027`, GT06 `5023`, JT808 `7611`.

## 7. Tek kullanıcı modu ne yapar

Sistemde çalışan izlemeye dair korumalar (aydınlatma teyidi, gerekçe zorunluluğu,
mola karartması, kabin kamerası sınırları) vardır. Makineyi siz kullandığınızda
izleyen ile izlenen aynı kişi olduğu için bunlar uygulanmaz:

| Kural | Tek kullanıcı modunda |
|-------|----------------------|
| Aydınlatma teyidi şartı | uygulanmaz |
| Kamera erişiminde gerekçe | istenmez |
| Mola / vardiya dışı karartma | uygulanmaz |
| Kabin kamerası sınırları | uygulanmaz |
| Operatöre bildirim | gönderilmez (kendinize) |
| **Amaçla sınırlılık** | **uygulanır** |
| **Denetim kaydı** | **yazılır** |

**Önemli:** Bu bir "kapat gitsin" anahtarı değildir. Makineye **başka bir
operatör atadığınız anda** (işçi alırsanız) korumalar o kişi için
kendiliğinden geri gelir — ayar değiştirmenize gerek kalmaz. Bu davranış
testlerle sabitlenmiştir (`apps/api/test/solo.test.ts`).

Açma/kapama:

```bash
curl -X PATCH $API/api/settings -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"soloMode": true}'
```

## 8. Alışveriş listesi (özet)

| Kalem | Neden | Not |
|-------|-------|-----|
| 4G GPS takip cihazı (kontak girişli) | Konum + çalışma saati | Sistemin temeli |
| M2M SIM | Cihaz bağlantısı | ~20–60 MB/ay yeter |
| Kontak kablosu çekimi | Çalışma saatinin doğruluğu | **Atlanmamalı** |
| CAN adaptörü *(opsiyonel)* | Motor devri, yakıt, motor saati | Makine CAN destekliyorsa |
| Yakıt sondası *(opsiyonel)* | Yakıt seviyesi | CAN yoksa ve yakıt kritikse |
| SD kartlı kayıt cihazı | Video | Platforma bağlanmaz, elle alınır |
| Yüksek kapasiteli SD kart | Kayıt süresi | 128 GB ≈ kanal başına ~1 hafta |
