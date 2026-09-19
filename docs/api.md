# REST API

Taban adres: `/api` · Kimlik: `Authorization: Bearer <token>`

Hata yanıtları ortak biçimdedir:

```json
{ "error": "Kabin ici kameranin canli izlenmesi kapalidir.",
  "code": "CABIN_LIVE_FORBIDDEN",
  "details": { "purpose": "kaza_inceleme", "auditId": 412 } }
```

`code` alanı makine okunur gerekçedir; arayüz kullanıcıya `error` metnini gösterir.

---

## Kimlik

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `POST /api/auth/login` | — | `{email, password}` → `{token, user}` |
| `GET /api/auth/me` | herkes | Profil + okunmamış aydınlatma metinleri |
| `POST /api/auth/change-password` | herkes | `{currentPassword, newPassword}` |

## Tek ekran

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/dashboard?date=YYYY-MM-DD` | herkes | Filo listesi + günlük özet + toplamlar |
| `GET /api/dashboard/:assetId?date=&points=` | herkes | Tek makine: konum, oturumlar, kameralar, yakıt, hakediş, gün izi |

Her ikisi de KVKK denetiminden geçer (`operasyon_yonetimi` varsayılan amaç);
denetim kaydı kullanıcı bazında birleştirilerek yazılır.

## Ayarlar

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/settings` | herkes | Firma ayarları (`solo_mode`, saat dilimi, para birimi) |
| `PATCH /api/settings` | owner | `{soloMode}` — tek kullanıcı modu |

## Filo

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/assets` | herkes | |
| `POST /api/assets` | owner, manager | |
| `PATCH /api/assets/:id` | owner, manager | `{nominalConsumptionLph, hourMeterHours, idleStrategy, ...}` |
| `GET /api/assets/:id/positions?from=&to=&limit=` | herkes | Mahremiyet maskelemesi uygulanır |
| `GET /api/assets/:id/sessions?from=&limit=` | herkes | |
| `GET /api/assets/:id/events?from=&severity=` | herkes | |
| `GET /api/assets/:id/geofence-events` | herkes | |
| `GET /api/assets/:id/fuel?from=` | herkes | Olaylar, fişler ve **tüketim özeti** (lt/saat, TL/saat) |
| `POST /api/assets/:id/fuel-transactions` | owner, manager, site_chief | Yakıt fişi girişi |
| `POST /api/assets/:id/sessions/start` | herkes | Elle vardiya başlat (cihaz yokken) |
| `POST /api/assets/:id/sessions/stop` | herkes | Elle vardiya bitir, `{idleMinutes?}` |
| `PATCH /api/devices/:id` | owner, manager | `{clockOffsetSec, model, utcOffsetMinutes, assetId}` |
| `PATCH /api/cameras/:id` | owner, manager | `{retrieval: 'integrated'\|'manual', label, sdRecording}` |
| `POST /api/events/:id/acknowledge` | herkes | |
| `GET/POST /api/devices` | owner, manager | |
| `POST /api/devices/:id/cameras` | owner, manager | `{retrieval}` ile bağımsız kayıt cihazı tanımlanır |
| `GET/POST /api/geofences`, `DELETE /api/geofences/:id` | değişken | |
| `GET /api/operators` | herkes | |
| `POST /api/assignments` | owner, manager, site_chief | |
| `GET /api/assets/:id/assignments` | herkes | |
| `GET/POST /api/rate-cards` | owner, manager | |
| `GET/POST /api/projects` | değişken | |

**Konum maskelemesi:** `GET /api/assets/:id/positions` yanıtında
`masked` alanı, mahremiyet bölgesi nedeniyle çıkarılan nokta sayısını verir;
`coarse: true` ise koordinatlar ~1 km hassasiyete yuvarlanmıştır.

## Kamera

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/assets/:assetId/cameras` | herkes | Kanal listesi ve mahremiyet sınıfı |
| `POST /api/media/live` | owner, manager, site_chief, dpo | `{cameraId, purpose, reason}` → yayın adresi. **Kabin kamerasında her zaman 403.** |
| `POST /api/media/:sessionId/stop` | aynı | İzlemeyi sonlandırır |
| `POST /api/media/playback` | aynı | `{cameraId, purpose, reason, from, to, eventId?}`. Kabin için `eventId` zorunlu; pencere olayın ±30 sn'sine sabitlenir |
| `GET /api/media/sd?cameraId=&from=&to=` | aynı | SD karttaki kayıt listesi |
| `POST /api/media/clip` | aynı | Kaydı sunucuya çektirir |
| `GET /api/media/requests` | herkes | Çekme taleplerinin durumu |
| `GET /api/events/:id/clip-window?beforeSec=&afterSec=` | herkes | **Bağımsız kayıt cihazı:** olayın SD karttaki zaman aralığı, cihaz saat sapması uygulanmış |

`retrieval: 'manual'` olan kameralarda `/api/media/live`, `/playback` ve `/sd`
uçları **409 `MANUAL_RETRIEVAL`** döner: görüntü platform üzerinden akmaz.

Kamera uçlarının tamamı: amaç kontrolü → rol kontrolü → aydınlatma teyidi →
gerekçe (≥15 karakter) → mahremiyet penceresi → kabin kuralları → denetim kaydı
→ operatöre bildirim.

**Tek kullanıcı modunda** (`solo_mode` açık ve ilgili kişi isteği yapanın
kendisi) amaç ve rol kontrolleri ile denetim kaydı aynen sürer; aydınlatma
teyidi, gerekçe, mahremiyet penceresi ve kabin kuralları uygulanmaz. Karar
kodu `ALLOWED_SOLO` olarak kayda geçer.

## Hakediş

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/billing?from=&to=&assetId=` | herkes | Günlük satırlar + hesap dökümü |
| `GET /api/billing/summary?from=&to=` | herkes | Varlık bazında dönem icmali |
| `GET /api/billing/export.csv?from=&to=` | owner, manager, dpo | Muhasebe için CSV (UTF‑8 BOM, `;` ayraç) |
| `POST /api/billing/recompute` | owner, manager, site_chief | `{assetId, date}` — yakıt tespiti + yeniden hesap. Onaylı gün → 409 |
| `POST /api/billing/:id/adjust` | owner, manager, site_chief | `{hours, note}` — gerekçeli elle düzeltme |
| `POST /api/billing/:id/approve` | owner, manager, site_chief | Günü kilitler |
| `POST /api/billing/approve-day` | owner, manager | `{date, projectId?}` toplu onay |

## KVKK

| Uç | Yetki | Açıklama |
|----|-------|----------|
| `GET /api/kvkk/purposes` | herkes | Amaç kataloğu ve hukuki sebepler |
| `GET /api/kvkk/notices` | herkes | Yayımlanmış metinler + teyit durumu |
| `GET /api/kvkk/notices/:id` | herkes | Metin gövdesi |
| `POST /api/kvkk/notices/:id/acknowledge` | herkes | Okudum teyidi |
| `POST /api/kvkk/notices/:id/withdraw` | herkes | Açık rızayı geri alma |
| `POST /api/kvkk/notices` | owner, dpo | Metin oluşturma/yayımlama |
| `GET /api/kvkk/acknowledgements` | owner, dpo, manager | Kim okudu / kim okumadı |
| `GET /api/kvkk/my-access-log` | herkes | **"Verime kim erişti"** (m.11) |
| `GET /api/kvkk/audit?result=&assetId=&userId=&limit=` | owner, dpo, manager | Denetim kaydı |
| `GET /api/kvkk/media-sessions` | owner, dpo, manager | Kim ne kadar izledi |
| `GET/POST /api/kvkk/privacy-windows` | değişken | Mola / vardiya dışı / özel kullanım |
| `DELETE /api/kvkk/privacy-windows/:id` | owner, dpo, manager | |
| `POST /api/kvkk/dsr` | herkes | İlgili kişi başvurusu (30 gün süre otomatik) |
| `GET /api/kvkk/dsr` | owner, dpo | Başvuru listesi, gecikenler işaretli |
| `POST /api/kvkk/dsr/:id/answer` | owner, dpo | Yanıtlama |
| `GET /api/kvkk/retention` | owner, dpo | Politikalar + imha durumu |
| `POST /api/kvkk/retention/run` | owner, dpo | İmhayı elle çalıştır |
| `GET /api/kvkk/compliance` | owner, dpo, manager | Uyum panosu (skor + kontrol listesi) |
| `GET /api/notifications` | herkes | Bildirim kutusu |
| `POST /api/notifications/:id/read` | herkes | Okundu işaretle |

### İşleme amaçları

| Kod | Erişebildiği veri |
|-----|-------------------|
| `is_guvenligi` | konum, oturum, olay, dış kamera, kabin olay klibi |
| `operasyon_yonetimi` | konum, oturum, olay |
| `hakedis_faturalama` | oturum, hakediş, geofence — **kamera yok** |
| `varlik_guvenligi` | konum, olay, dış kamera, yakıt |
| `kaza_inceleme` | konum, oturum, olay, dış kamera, kabin olay klibi, kayıt |
| `bakim_arizalar` | oturum, yakıt, olay, teşhis |
| `hukuki_talep` | tümü |

## Telemetri girişi

Kimlik: `x-ingest-key` başlığı (kullanıcı oturumu gerekmez).

| Uç | Açıklama |
|----|----------|
| `POST /api/ingest` | Esnek JSON. Tek nesne veya dizi. `deviceId`/`imei` zorunlu |
| `POST /api/ingest/decoded` | `{records: NormalizedRecord[]}` — ingest sunucusu kullanır |
| `GET /api/ingest/health` | Sağlık |

Örnek:

```bash
curl -X POST http://localhost:8080/api/ingest \
  -H 'content-type: application/json' -H "x-ingest-key: $INGEST_KEY" \
  -d '{"deviceId":"356307042441013","lat":40.91,"lon":29.21,
       "speed":0,"ignition":true,"rpm":1600,"fuelLevel":78,
       "ts":"2026-09-18T08:15:00Z"}'
```

Yanıt: `{"accepted":1,"skipped":0,"unknownDevices":[]}`

## Sağlık

`GET /health` → `{ok, env, ts}` (kimlik gerekmez)
