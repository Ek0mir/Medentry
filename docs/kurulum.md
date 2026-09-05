# Kurulum

MİRFİX Operasyon Katmanı'nı sıfırdan ayağa kaldırma adımları.

> **Temel kural:** Bu sistem Mikro'yu **yalnızca okur**. Mikro'ya hiçbir koşulda
> yazmaz. Kurulum sırasında verilen SQL kullanıcısının `SELECT` dışında yetkisi
> olmamalı — bu, muhasebe verisinin bütünlüğünü koruyan tek güvencedir.

## 1. Mini PC

Mikro'nun çalıştığı sunucuya **hiçbir şey kurulmaz**. Ayrı bir mini PC, aynı ofis
ağında ikinci düğüm olarak konumlanır.

- 16 GB RAM, 512 GB SSD yeterli
- 7/24 açık, kesintisiz güç kaynağına bağlı
- Router üzerinden sabit yerel IP (örn. `192.168.1.50`)
- Docker + Docker Compose kurulu

## 2. Depoyu al ve ayarla

```bash
git clone <depo-adresi> mirfix-operasyon
cd mirfix-operasyon
cp .env.example .env
```

`.env` içinde **mutlaka** değiştirin:

```bash
# Oturum çerezlerini imzalar. Bu değer sızarsa oturumlar taklit edilebilir.
OTURUM_SIRRI=$(openssl rand -hex 32)
POSTGRES_PASSWORD=<güçlü bir parola>
```

## 3. Ayağa kaldır

```bash
docker compose up -d
```

Uygulama açılışta veritabanı geçişlerini kendisi uygular. Ardından başlangıç
verisini oluşturun:

```bash
docker compose exec app node -e "import('./apps/server/dist/db/tohum.js')"
# veya depo içinden:
npm run tohum
```

Bu komut beş kullanıcıyı oluşturur ve **parolaları bir kez ekrana yazar**. Not
alın; bir daha gösterilmez. İlk girişten sonra herkes kendi parolasını
değiştirmeli (panel → sağ alt → parola).

Panel: `http://192.168.1.50:8080`
API belgeleri: `http://192.168.1.50:8080/api/belgeler`

## 4. Mikro bağlantısı

`MIKRO_ADAPTER` üç değer alır:

| Değer | Ne zaman | Ne gerekir |
|---|---|---|
| `seed` | Eğitim, demo, Mikro'suz geliştirme | Hiçbir şey — gerçekçi sahte veri üretir |
| `csv` | Faz 1 başlangıcı, manuel export ile | `MIKRO_CSV_DIZIN` altına export dosyaları + `docs/mikro-eslesme.json` doldurulmuş |
| `mssql` | Üretim | Salt-okunur SQL kullanıcısı + `docs/mikro-eslesme.json` doldurulmuş |

### Salt-okunur SQL kullanıcısı (Mikro sunucusunda)

```sql
CREATE LOGIN mirfix_okuma WITH PASSWORD = '<güçlü parola>';
USE [MikroDB_V16];
CREATE USER mirfix_okuma FOR LOGIN mirfix_okuma;
-- Yalnızca okuma. Yazma yetkisi VERİLMEZ.
ALTER ROLE db_datareader ADD MEMBER mirfix_okuma;
DENY INSERT, UPDATE, DELETE, ALTER TO mirfix_okuma;
```

Mümkünse doğrudan tabloya değil, Mikro tarafında açılacak bir **VIEW**'a bağlanın:
sürüm güncellemesinde kırılma view katmanında soğurulur, bizim tarafımıza
yansımaz.

### Alan eşlemesi

`docs/mikro-eslesme.json` içindeki tüm `TEYIT_EDILECEK_*` değerleri Faz 0'daki
tablo keşfinden sonra doldurulur. Sol taraftaki anahtarlar (bizim normalize alan
adlarımız) **değişmez**; yalnızca sağ taraf güncellenir.

Bağlantıyı doğrulayın:

```bash
npm run is -- W-01     # senkron
npm run is -- W-02     # yaşlandırma + risk
npm run is -- W-03     # arama listesi
```

## 5. Yedekleme

`W-15` her gece 03:30'da `pg_dump` alır, arşivin okunabilirliğini `pg_restore --list`
ile doğrular ve `YEDEK_SAKLAMA_GUN` süresini aşanları siler.

**Geri yükleme tatbikatı bir kez fiilen yapılmalıdır** — denenmemiş yedek, yedek
değildir:

```bash
createdb mirfix_tatbikat
pg_restore -d mirfix_tatbikat /yedek/mirfix-<damga>.dump
psql -d mirfix_tatbikat -c "SELECT count(*) FROM op_gorev"
dropdb mirfix_tatbikat
```

## 6. İstemciler

Kurulum yok. Dört bilgisayarda tarayıcıya `http://192.168.1.50:8080` yer imi
eklenir. Her kullanıcı kendi hesabıyla girer.

## Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| Panel açılmıyor | `docker compose logs app` |
| Arama listesi boş | Yönetim → İşler → W-02 ve W-03 çalıştı mı; açık vadesi geçen bakiye var mı |
| Satışçı hiç cari göremiyor | Yönetim → Kullanıcılar → **Mikro temsilci** eşlemesi yapılmış mı |
| Senkron bayat | Yönetim → Sistem sağlığı; `stg_senkron_log` son kaydına bakın |
| Excel'de Türkçe karakter bozuk | CSV'yi panelden indirin (BOM'lu yazılır), Mikro'nun ham çıktısını değil |

## Zamanlanmış işler

| Kod | Saat | İş |
|---|---|---|
| `W-01` | 02:00 | Mikro senkron |
| `W-02` | 02:30 | Yaşlandırma + risk skorlama |
| `W-03` | iş günü 08:00 | Günlük arama listesi |
| `W-05` | iş günü 17:00 | Aranmayan kayıt eskalasyonu |
| `W-11` | saatlik | Genel görev eskalasyonu |
| `W-14` | 30 dakikada bir | Sistem sağlığı |
| `W-15` | 03:30 | Yedekleme ve doğrulama |

`ISLER_ACIK=0` ile tamamı kapatılabilir (test ortamı için).

## Resmî tatiller

Sabit tarihli bayramlar tohumla gelir. **Ramazan ve Kurban Bayramı hicri takvime
göre kaydığı için yazılmadı** — her yıl Yönetim ekranından eklenmeli. Eksik tatil,
eskalasyon saatlerinin tatil gününde işlemesine yol açar.
