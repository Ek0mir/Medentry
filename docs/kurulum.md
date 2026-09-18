# Kurulum ve Üretime Alma

## 1. Yerel geliştirme

```bash
npm install
docker compose up -d postgres
cp .env.example .env
npm run db:seed

npm run dev:api      # :8080
npm run dev:ingest   # :5023 :5027 :7611, komut :8081
npm run dev:web      # :5173
npm run simulate -- --days 2
```

## 2. Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `DATABASE_URL` | `postgres://medentry:medentry@localhost:5432/medentry` | PostgreSQL bağlantısı |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | API dinleme adresi |
| `JWT_SECRET` | — | **Üretimde zorunlu.** En az 32 karakter rastgele |
| `JWT_TTL_SECONDS` | `43200` | Oturum ömrü (12 saat) |
| `INGEST_KEY` | — | **Üretimde zorunlu.** Cihaz girişi paylaşılan anahtarı |
| `CORS_ORIGINS` | `*` | Üretimde arayüz kökeniyle sınırlayın |
| `MEDIA_PROVIDER` | `mock` | `jt1078` (gerçek donanım) veya `mock` (demo) |
| `MEDIA_GATEWAY_HOST` | `127.0.0.1` | Cihazın RTP akışını açacağı **dışarıdan erişilebilir** adres |
| `MEDIA_GATEWAY_TCP_PORT` | `7618` | Medya geçidi portu |
| `MEDIA_PLAYBACK_BASE_URL` | `http://127.0.0.1:8888` | İzleyiciye verilen HLS taban adresi |
| `MEDIA_TOKEN_TTL_SECONDS` | `120` | Yayın jetonu ömrü |
| `MEDIA_LIVE_MAX_SECONDS` | `300` | Canlı izleme üst sınırı |
| `MEDIA_COMMAND_ENDPOINT` | `http://127.0.0.1:8081/command` | Ingest komut kanalı |
| `MEDIA_FTP_*` | — | Olay klibi yükleme hedefi |
| `SESSION_MAX_GAP_SEC` | `1800` | Bu süreyi aşan veri kesintisinde oturum kapatılır |
| `SESSION_IDLE_MIN_SEC` | `300` | Bu sürenin altındaki duraklama rölanti sayılmaz |
| `JOB_ROLLUP_INTERVAL_MS` | `900000` | Hakediş yeniden hesabı sıklığı |
| `JOB_RETENTION_ENABLED` | `true` | Otomatik imha işi |

> `JWT_SECRET` ve `INGEST_KEY` üretimde tanımlı değilse süreç **başlamaz**.

## 3. Üretim mimarisi

```
                internet
                    │
            ┌───────┴────────┐
            │  ters vekil    │  TLS sonlandırma (nginx / Caddy)
            │  (443)         │
            └───┬────────┬───┘
                │        │
          /api  │        │  /  (statik arayüz)
                ▼        ▼
             API :8080   dist/
                │
                ├──────── PostgreSQL (özel ağ, TLS)
                │
                └──────── ingest :8081 (komut kanalı, yalnız iç ağ)

  cihazlar ──TCP 5023/5027/7611──▶ ingest      (yalnız bu portlar dışa açık)
  cihazlar ──RTP 7618────────────▶ medya geçidi
```

**Ağ kuralları**

| Port | Kime açık |
|------|-----------|
| 443 | Herkese (arayüz + API) |
| 5023 / 5027 / 7611 | Yalnız GSM operatörünüzün APN aralığına (mümkünse) |
| 7618 | Cihazlara (RTP) |
| 8080 / 8081 / 5432 | **Dışa kapalı** |

## 4. Üretim adımları

```bash
# 1) Kod ve bağımlılıklar
npm ci
npm run typecheck && npm test

# 2) Arayüzü derle
npm run build -w @medentry/web       # apps/web/dist

# 3) Şema
DATABASE_URL=... npm run db:migrate   # seed ÇALIŞTIRMAYIN: demo veri üretir

# 4) Gerçek kiracıyı oluşturun
#    - companies satırı (unvan, VERBİS no, KVKK irtibat)
#    - owner kullanıcısı (güçlü parola)
#    - aydınlatma metinleri: POST /api/kvkk/notices
#    - saklama politikaları: retention_policies
#    - mahremiyet pencereleri: POST /api/kvkk/privacy-windows

# 5) Servisler (systemd / Docker)
NODE_ENV=production node --import tsx apps/api/src/server.ts
NODE_ENV=production node --import tsx apps/ingest/src/index.ts
```

Systemd örneği:

```ini
[Unit]
Description=Medentry API
After=network.target postgresql.service

[Service]
Type=simple
User=medentry
WorkingDirectory=/opt/medentry
EnvironmentFile=/etc/medentry/api.env
ExecStart=/usr/bin/node --import tsx apps/api/src/server.ts
Restart=always
RestartSec=5
# Sır içeren dosyaya erişimi kısıtla
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/medentry

[Install]
WantedBy=multi-user.target
```

## 5. Yedekleme

| Veri | Yöntem | Sıklık | Saklama |
|------|--------|--------|---------|
| PostgreSQL | `pg_dump` veya WAL arşivi | Günlük tam + sürekli WAL | 30 gün |
| Kamera klipleri | Nesne depolama (S3 uyumlu) | Yükleme anında | Saklama politikasına göre |
| Ortam dosyaları | Şifreli kasa (vault) | Değişimde | — |

**Önemli:** Yedekler de kişisel veri içerir. Yedek saklama süresi, imha
politikasıyla uyumlu olmalıdır (aksi halde "sildik" dediğiniz veri yedeklerde
yaşamaya devam eder). 30 günlük rotasyon önerilir.

Geri yükleme provası **altı ayda bir** yapılmalı ve tutanağa bağlanmalıdır.

## 6. İzleme

| Kontrol | Nasıl |
|---------|-------|
| API sağlığı | `GET /health` |
| Bağlı cihaz sayısı | `GET http://ingest:8081/health` (x-ingest-key ile) |
| Susmuş cihaz | `SELECT ident, last_seen_at FROM devices WHERE last_seen_at < now() - interval '2 hours'` |
| Tanımsız cihaz | `SELECT * FROM unknown_devices ORDER BY last_seen_at DESC` |
| İmha işi | `GET /api/kvkk/retention` (son çalışma zamanı) |
| Uyum durumu | `GET /api/kvkk/compliance` |
| Açık kalmış oturum | `SELECT * FROM work_sessions WHERE is_open AND started_at < now() - interval '1 day'` |

## 7. Veritabanını sıfırlama (geliştirme)

```bash
docker compose down -v && docker compose up -d postgres
npm run db:seed
```

## 8. Sorun giderme

| Belirti | Kontrol |
|---------|---------|
| `Zorunlu ortam degiskeni eksik: JWT_SECRET` | Üretimde `.env` yüklenmemiş |
| Cihaz bağlanıyor ama veri yok | Cihaz `devices` tablosunda kayıtlı mı? `unknown_devices`'a bakın |
| Çalışma saati görünmüyor | Kontak kablosu bağlı mı? `positions.ignition` NULL mı? |
| Kamera açılmıyor, 403 | Yanıt gövdesindeki `code` alanı nedeni söyler (`PRIVACY_WINDOW`, `NOTICE_NOT_ACKNOWLEDGED`…) |
| Kamera açılmıyor, 500 | Ingest komut kanalı ayakta mı? Cihaz çevrimiçi mi? |
| Hakediş 0 TL | Varlığa tarife kartı atanmış mı? (`assets.rate_card_id`) |
| Hakediş güncellenmiyor | Gün onaylanmış olabilir (`status != 'draft'`) |
