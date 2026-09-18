# Mimari

## 1. Tasarım kararları ve gerekçeleri

| Karar | Gerekçe |
|-------|---------|
| İş mantığı **saf fonksiyon** (`packages/domain`) | Hakediş hesabı itiraza konu olur; aynı girdinin her zaman aynı sonucu vermesi ve testle kanıtlanabilmesi gerekir |
| Ingest **ayrı süreç** | Cihaz TCP oturumları uzun ömürlüdür; API yeniden başlatılınca kopmamalıdır |
| KVKK kuralları **kodda** | Politika belgesi denetlenemez, kod denetlenebilir. Kural değişirse test kırılır |
| PostGIS **yok** | Saha mesafeleri için haversine + ray-casting yeterli; kurulum ve bakım yükü azalır |
| Protokol çözücüleri **bağımlılıksız** | Cihaz protokolü, veritabanı ve HTTP'den bağımsız test edilebilir |
| Zaman damgaları **UTC**, gün sınırı **şirket saat diliminde** | Puantaj ve hakediş "gün"ü yerel gündür; kayıt UTC olmalıdır |

## 2. Katmanlar

```
packages/shared      tipler, coğrafi/zaman yardımcıları, amaç→veri matrisi
       ▲
packages/protocols   GT06 · Teltonika Codec8/8E · JT/T 808+1078 · generic JSON
       ▲
packages/domain      oturum · geofence · yakıt · hakediş · KVKK politikası
       ▲
apps/api             HTTP + veritabanı + işleme hattı + periyodik işler
apps/ingest          cihaz TCP sunucuları + kamera komut kanalı
apps/web             mobil arayüz
```

Bağımlılık yönü tek yönlüdür: `domain` asla `api`'yi bilmez.

## 3. Telemetri işleme hattı

`apps/api/src/pipeline/ingest.ts` — her normalize kayıt için:

```
1. resolveDevice(ident)         → cihaz/varlık (60 sn önbellek)
                                   bulunamazsa → unknown_devices
2. insertPosition()             → positions (asset_id, ts, device_id) tekilliği
3. geçmişe dönük kayıt kontrolü → canlı durumu bozmaz, konum yine saklanır
4. deriveIgnition()             → cihaz bildirimi ▸ RPM ▸ voltaj ▸ hareket ▸ hız
5. updateSessionState()         → kontak geçişi: oturum aç / kapat
                                   veri kesintisi > 30 dk → son kayıtta kapat
6. updateGeofences()            → histerezisli giriş/çıkış olayları
7. recordAlarms()               → device_events; ağır olayda media_requests
8. upsertAssetState()           → tek ekranın okuduğu canlı durum
```

**Neden `asset_state` tablosu var?** Tek ekran, en son konumu her açılışta
milyonlarca satırlık `positions` tablosundan aramak zorunda kalmamalıdır.
`asset_state` her kayıtta güncellenen tek satırdır.

### Oturum kapanışı

Kontak kapandığında oturum penceresi (`started_at` → `ended_at`) yeniden
okunur ve `summarizeWindow()` ile süre/rölanti/mesafe hesaplanır. Böylece
oturum özeti, gecikmiş kayıtlar dâhil tüm veriyi kapsar.

## 4. Veri modeli (özet)

```
companies ─┬─ users ─── notice_acknowledgements ─── privacy_notices
           ├─ projects ─── rate_cards
           ├─ assets ─┬─ devices ─── device_cameras
           │          ├─ asset_state          (canlı durum, 1:1)
           │          ├─ positions            (zaman serisi)
           │          ├─ device_events        (alarm/olay)
           │          ├─ work_sessions        (puantaj)
           │          ├─ operator_assignments (kim kullanıyor)
           │          ├─ fuel_events / fuel_transactions
           │          ├─ daily_billing        (hakediş, satır dökümü jsonb)
           │          ├─ media_sessions       (kim izledi)
           │          ├─ recordings           (saklama süresi + legal hold)
           │          └─ media_requests       (SD'den klip çekme)
           ├─ geofences ─── geofence_events
           ├─ privacy_windows
           ├─ retention_policies
           ├─ data_access_log      (izin verilen VE reddedilen erişimler)
           ├─ dsr_requests         (ilgili kişi başvuruları)
           └─ notifications
```

Tüm tablolar `company_id` taşır (çok kiracılı).

## 5. Periyodik işler

| İş | Sıklık | Yaptığı |
|----|--------|---------|
| `runRollup` | 15 dk | Dün ve bugün için yakıt olaylarını tespit eder, hakedişi yeniden hesaplar |
| `closeStaleSessions` | 5 dk | Cihaz susmuşken açık kalan oturumları kapatır (hakedişin şişmesini önler) |
| `runRetention` | 6 saat | Saklama süresi dolan kayıtları siler/anonimleştirir, sonucu belgeler |

Onaylanmış (`status != 'draft'`) hakediş günleri yeniden hesaplanmaz — onaydan
sonra gelen telemetri, mutabık kalınan tutarı değiştiremez.

## 6. Kamera akışı

```
telefon ──POST /api/media/live──▶ API
                                   │ 1. guardAccess()  → KVKK politikası
                                   │ 2. data_access_log
                                   │ 3. media_sessions kaydı
                                   │ 4. kısa ömürlü yayın jetonu (120 sn)
                                   ▼
                              MediaProvider
                                   │ JT/T 1078 0x9101 çerçevesi
                                   ▼
                          ingest komut kanalı (:8081)
                                   │ cihazın açık TCP soketi
                                   ▼
                                cihaz ──RTP──▶ medya geçidi ──HLS──▶ telefon
                                   │
                              operatöre bildirim
```

Politika reddederse **cihaza hiçbir komut gitmez**. Yayın jetonu kısa ömürlüdür;
bağlantı paylaşılsa bile birkaç dakika içinde düşer.

`MediaProvider` arayüzü sayesinde farklı marka/protokol eklemek tek dosyalık
iştir (`apps/api/src/media/`).

## 7. Ölçekleme notları

Mevcut yapı **birkaç yüz araca** kadar tek sunucuda rahat çalışır. Ötesinde:

| Sınır | Çözüm |
|-------|-------|
| `positions` tablosu büyümesi | Aylık `PARTITION BY RANGE (ts)`; imha, bölüm düşürerek yapılır |
| Ingest tek süreç | Protokol başına ayrı süreç; cihaz→sunucu eşlemesi için tutarlı hash |
| API ↔ ingest arası HTTP | Kuyruk (NATS/Redis Stream) ile arabelleğe alma |
| Periyodik işler tek süreçte | Ayrı zamanlayıcı servis + `pg_advisory_lock` ile tekilleştirme |
| Canlı video | Medya geçidini yatay ölçekleyin; cihaza verilen `MEDIA_GATEWAY_HOST` yük dengeleyici olmalı |
| Okuma yükü | `daily_billing` ve `asset_state` zaten önden hesaplanmış; okuma replikası eklenebilir |

## 8. Güvenlik

- Parolalar `scrypt` (N=16384, r=8, p=1), sabit zamanlı karşılaştırma.
- Oturum jetonu HS256 JWT, 12 saat; **yayın jetonu ayrı kapsamda** (`scope: 'stream'`)
  ve API çağrısında kullanılamaz.
- Cihaz girişi paylaşılan anahtarla (`INGEST_KEY`); bu uç iç ağa açılmalıdır.
- Tüm SQL parametrelidir; tek istisna test veritabanı adıdır ve regex ile kısıtlıdır.
- Fastify günlüklerinde `authorization` ve `x-ingest-key` maskelenir.
- Rol + amaç matrisi çift katman: rol yetkisi olsa bile amaç uyuşmazsa erişim reddedilir.
