/**
 * Tek kisilik isletme kurulumu.
 *
 * Demo verisi (seed) yerine GERCEK kurulumu olusturur: tek sirket, tek
 * kullanici (hem sahip hem operator), bir makine, bir takip cihazi ve
 * istege bagli bir bagimsiz kayit cihazi.
 *
 * Kullanim:
 *   OWNER_EMAIL=ben@firmam.com OWNER_PASSWORD='...' \
 *   ASSET_CODE=EKS-01 TRACKER_IMEI=356307042441013 \
 *   npm run setup:solo
 *
 * Tum degerlerin varsayilani vardir; sonradan arayuzden degistirilebilir.
 */

import { hashPassword } from '../auth/password.js';
import { closePool, query, queryOne } from './pool.js';
import { migrate } from './migrate.js';

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function envNum(key: string, fallback: number | null): number | null {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function setupSolo(): Promise<void> {
  await migrate();

  const ownerEmail = env('OWNER_EMAIL', 'ben@firmam.com.tr').toLowerCase();
  const ownerPassword = env('OWNER_PASSWORD', '');
  const ownerName = env('OWNER_NAME', 'Isletme Sahibi');
  const companyName = env('COMPANY_NAME', 'Isletmem');

  if (ownerPassword.length < 8) {
    throw new Error(
      'OWNER_PASSWORD en az 8 karakter olmalidir. Ornek:\n' +
        "  OWNER_EMAIL=ben@firmam.com OWNER_PASSWORD='GucluParola123' npm run setup:solo",
    );
  }

  const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE lower(email) = $1`, [
    ownerEmail,
  ]);
  if (existing) {
    console.log(`[setup] ${ownerEmail} zaten kayitli. Yeni kurulum yapilmadi.`);
    return;
  }

  // ------------------------------------------------------------------ sirket
  // solo_mode: calisan koruma kurallari, izleyen ile izlenen ayni kisi
  // oldugunda uygulanmaz. Ileride operator ise alinirsa kendiliginden doner.
  const company = await queryOne<{ id: string }>(
    `INSERT INTO companies (name, timezone, currency, solo_mode)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [companyName, env('TIMEZONE', 'Europe/Istanbul'), env('CURRENCY', 'TRY')],
  );
  const companyId = company!.id;

  const owner = await queryOne<{ id: string }>(
    `INSERT INTO users (company_id, email, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, $4, 'owner', $5)
     RETURNING id`,
    [companyId, ownerEmail, await hashPassword(ownerPassword), ownerName, env('OWNER_PHONE', '')],
  );
  const ownerId = owner!.id;

  // ------------------------------------------------------------------ tarife
  const hourlyRate = envNum('HOURLY_RATE', 1850)!;
  const rateCard = await queryOne<{ id: string }>(
    `INSERT INTO rate_cards
       (company_id, name, currency, mode, hourly_rate, min_hours_per_day,
        overtime_after_hours, overtime_multiplier, idle_billable, transport_fee,
        fuel_included, fuel_price_per_liter, vat_rate, rounding_step_hours, rounding_mode)
     VALUES ($1, 'Saatlik tarife', $2, $3, $4, $5, $6, 1.5, false, $7, $8, $9, $10, 0.25, 'up')
     RETURNING id`,
    [
      companyId,
      env('CURRENCY', 'TRY'),
      envNum('MIN_HOURS', null) === null ? 'hourly' : 'hourly_with_min',
      hourlyRate,
      envNum('MIN_HOURS', null),
      envNum('OVERTIME_AFTER_HOURS', null),
      envNum('TRANSPORT_FEE', null),
      env('FUEL_INCLUDED', 'true') === 'true',
      envNum('FUEL_PRICE', null),
      envNum('VAT_RATE', 0.2),
    ],
  );

  // ------------------------------------------------------------------ makine
  const assetCode = env('ASSET_CODE', 'MAK-01');
  const asset = await queryOne<{ id: string }>(
    `INSERT INTO assets
       (company_id, code, name, category, asset_type, plate, make, model,
        fuel_tank_liters, nominal_consumption_lph, hour_meter_offset_sec,
        idle_strategy, rate_card_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      companyId,
      assetCode,
      env('ASSET_NAME', 'Makinem'),
      env('ASSET_CATEGORY', 'machine'),
      env('ASSET_TYPE', 'excavator'),
      env('ASSET_PLATE', '') || null,
      env('ASSET_MAKE', '') || null,
      env('ASSET_MODEL', '') || null,
      envNum('FUEL_TANK_LITERS', null),
      // Sensor yoksa yakit bu degerden tahmin edilir; fis girisleriyle kalibre edilir.
      envNum('NOMINAL_LPH', null),
      Math.round((envNum('HOUR_METER_HOURS', 0) ?? 0) * 3600),
      // CAN yoksa rolanti, cihazin hareket sensorunden anlasilir.
      env('IDLE_STRATEGY', 'movement'),
      rateCard!.id,
    ],
  );
  const assetId = asset!.id;

  // Kullanici kendi makinesinin operatoru olarak atanir; boylece "kim
  // kullaniyor" alani dolar ve puantaj kisiye baglanir.
  await query(
    `INSERT INTO operator_assignments (company_id, asset_id, operator_id, starts_at, source, assigned_by)
     VALUES ($1,$2,$3, now(), 'manual', $3)`,
    [companyId, assetId, ownerId],
  );

  // ------------------------------------------------------------- takip cihazi
  const trackerImei = env('TRACKER_IMEI', '');
  if (trackerImei) {
    await query(
      `INSERT INTO devices (company_id, asset_id, kind, protocol, ident, sim_msisdn, model, installed_at)
       VALUES ($1,$2,'tracker',$3,$4,$5,$6, now())`,
      [
        companyId,
        assetId,
        env('TRACKER_PROTOCOL', 'teltonika'),
        trackerImei,
        env('TRACKER_SIM', '') || null,
        env('TRACKER_MODEL', '') || null,
      ],
    );
  }

  // --------------------------------------------------------- kayit cihazi
  // Platforma bagli olmayan, SD karta kaydeden bagimsiz kamera. Goruntu
  // elle alinir; platform yalnizca olayin hangi zaman araliginda aranacagini
  // soyler (GET /api/events/:id/clip-window).
  const recorderModel = env('RECORDER_MODEL', '');
  if (recorderModel) {
    const recorder = await queryOne<{ id: string }>(
      `INSERT INTO devices (company_id, asset_id, kind, protocol, ident, model, installed_at)
       VALUES ($1,$2,'ipcam','generic',$3,$4, now())
       RETURNING id`,
      [companyId, assetId, `recorder-${assetCode}`, recorderModel],
    );
    const channels = env('RECORDER_CHANNELS', 'front,cabin').split(',').map((c) => c.trim());
    for (const [index, position] of channels.entries()) {
      await query(
        `INSERT INTO device_cameras
           (company_id, device_id, channel_no, position, label, records_audio,
            privacy_class, event_only, sd_recording, retrieval)
         VALUES ($1,$2,$3,$4,$5,false,$6,false,true,'manual')`,
        [
          companyId,
          recorder!.id,
          index + 1,
          position,
          `${recorderModel} - ${position}`,
          position === 'cabin' ? 'high' : 'standard',
        ],
      );
    }
  }

  console.log('[setup] Tek kullanici kurulumu tamamlandi.');
  console.log('[setup] --------------------------------------------');
  console.log(`[setup] Sirket      : ${companyName} (tek kullanici modu: acik)`);
  console.log(`[setup] Giris       : ${ownerEmail}`);
  console.log(`[setup] Makine      : ${assetCode} (${env('ASSET_TYPE', 'excavator')})`);
  console.log(`[setup] Tarife      : ${hourlyRate} ${env('CURRENCY', 'TRY')}/saat`);
  console.log(
    `[setup] Takip cihazi: ${trackerImei ? `${trackerImei} (${env('TRACKER_PROTOCOL', 'teltonika')})` : 'tanimlanmadi'}`,
  );
  console.log(`[setup] Kayit cihazi: ${recorderModel || 'tanimlanmadi'}`);
  console.log('[setup] --------------------------------------------');
  if (!trackerImei) {
    console.log('[setup] Takip cihazi yok: calisma saatini elle baslatip bitirebilirsiniz');
    console.log('[setup] (arayuzde "Vardiya baslat" dugmesi).');
  }
}

const isDirectRun = process.argv[1]?.includes('setup-solo');
if (isDirectRun) {
  setupSolo()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[setup] hata:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
