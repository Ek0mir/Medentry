/**
 * Demo/gelistirme verisi.
 *
 * Gercek bir santiye kurulumunu taklit eder: 2 ekskavator, 1 kamyon, 1 operator
 * pickup'i; takip cihazlari, kameralar, santiye ve depo citleri, tarife
 * kartlari, mahremiyet pencereleri ve KVKK aydinlatma metinleri.
 *
 * Aydinlatma metinleri `docs/kvkk/` altindaki dosyalardan okunur; boylece
 * belge ile veritabani arasinda tek kaynak korunur.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../auth/password.js';
import { closePool, query, queryOne } from './pool.js';
import { migrate } from './migrate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const DOCS = join(ROOT, 'docs', 'kvkk');

const DEMO_PASSWORD = process.env['SEED_PASSWORD'] ?? 'Medentry2026!';

async function readNotice(file: string, fallbackTitle: string): Promise<{ title: string; body: string }> {
  try {
    const body = await readFile(join(DOCS, file), 'utf8');
    const firstLine = body.split('\n').find((line) => line.startsWith('# '));
    return { title: firstLine ? firstLine.replace(/^#\s*/, '') : fallbackTitle, body };
  } catch {
    return { title: fallbackTitle, body: `# ${fallbackTitle}\n\n(Metin dosyasi bulunamadi.)` };
  }
}

/** Testlerde ciktiyi susturur. */
const log = (...args: unknown[]): void => {
  if (process.env['NODE_ENV'] !== 'test') console.log(...args);
};

export async function seed(): Promise<void> {
  await migrate();

  const existing = await queryOne<{ id: string }>(`SELECT id FROM companies LIMIT 1`);
  if (existing) {
    log('[seed] veri zaten mevcut, atlaniyor. Sifirlamak icin: npm run db:reset');
    return;
  }

  // ---------------------------------------------------------------- sirket
  const company = await queryOne<{ id: string }>(
    `INSERT INTO companies (name, tax_number, timezone, currency, kvkk_contact_name, kvkk_contact_email)
     VALUES ('Medipol Muhendislik Hizmetleri A.S.', '1234567890', 'Europe/Istanbul', 'TRY',
             'Zeynep Aydin', 'kvkk@ornek-firma.com.tr')
     RETURNING id`,
  );
  const companyId = company!.id;

  // -------------------------------------------------------------- kullanici
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = await query<{ id: string; email: string; role: string }>(
    `INSERT INTO users (company_id, email, password_hash, full_name, role, phone, employee_no)
     VALUES
       ($1,'sahip@ornek-firma.com.tr',   $2, 'Mehmet Demir',  'owner',      '+905301112233', 'P-001'),
       ($1,'yonetici@ornek-firma.com.tr',$2, 'Ayse Kaya',     'manager',    '+905301112234', 'P-002'),
       ($1,'sef@ornek-firma.com.tr',     $2, 'Hakan Yildiz',  'site_chief', '+905301112235', 'P-003'),
       ($1,'kvkk@ornek-firma.com.tr',    $2, 'Zeynep Aydin',  'dpo',        '+905301112236', 'P-004'),
       ($1,'operator1@ornek-firma.com.tr',$2,'Ali Ozturk',    'operator',   '+905301112237', 'P-101'),
       ($1,'operator2@ornek-firma.com.tr',$2,'Murat Sahin',   'operator',   '+905301112238', 'P-102'),
       ($1,'muhasebe@ornek-firma.com.tr',$2, 'Elif Arslan',   'viewer',     '+905301112239', 'P-005')
     RETURNING id, email, role`,
    [companyId, passwordHash],
  );
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const operator1 = byEmail.get('operator1@ornek-firma.com.tr')!;
  const operator2 = byEmail.get('operator2@ornek-firma.com.tr')!;
  const dpoId = byEmail.get('kvkk@ornek-firma.com.tr')!;

  // ----------------------------------------------------------------- proje
  const project = await queryOne<{ id: string }>(
    `INSERT INTO projects (company_id, name, customer, starts_on)
     VALUES ($1, 'Kartal Konut Projesi - Hafriyat', 'ABC Insaat Ltd. Sti.', CURRENT_DATE - 60)
     RETURNING id`,
    [companyId],
  );
  const projectId = project!.id;

  // ---------------------------------------------------------- tarife karti
  const rateCards = await query<{ id: string; name: string }>(
    `INSERT INTO rate_cards
       (company_id, project_id, name, currency, mode, hourly_rate, daily_rate, monthly_rate,
        min_hours_per_day, overtime_after_hours, overtime_multiplier, idle_billable,
        idle_hourly_rate, transport_fee, fuel_included, fuel_price_per_liter, vat_rate,
        rounding_step_hours, rounding_mode)
     VALUES
       ($1,$2,'Ekskavator - saatlik (8 saat garanti)','TRY','hourly_with_min',
        1850, NULL, NULL, 8, 9, 1.5, false, 550, 6500, false, 46.50, 0.20, 0.25, 'up'),
       ($1,$2,'Kamyon - gunluk goturu','TRY','daily',
        1200, 9500, NULL, NULL, 9, 1.5, true, NULL, NULL, true, NULL, 0.20, 0.25, 'up'),
       ($1,NULL,'Operator araci - aylik','TRY','monthly',
        NULL, NULL, 42000, NULL, NULL, NULL, true, NULL, NULL, true, NULL, 0.20, NULL, 'nearest')
     RETURNING id, name`,
    [companyId, projectId],
  );
  const excavatorRate = rateCards[0]!.id;
  const truckRate = rateCards[1]!.id;
  const pickupRate = rateCards[2]!.id;

  // --------------------------------------------------------------- varlik
  const assets = await query<{ id: string; code: string }>(
    `INSERT INTO assets
       (company_id, code, name, category, asset_type, plate, make, model, model_year,
        fuel_tank_liters, idle_strategy, project_id, rate_card_id)
     VALUES
       ($1,'EKS-01','Ekskavator 1','machine','excavator', NULL,'Caterpillar','320D', 2019, 410, 'rpm', $2, $3),
       ($1,'EKS-02','Ekskavator 2','machine','excavator', NULL,'Hidromek','HMK 370', 2021, 460, 'movement', $2, $3),
       ($1,'KMY-01','Damperli Kamyon 1','vehicle','truck','34 ABC 123','Ford','2533', 2020, 400, 'speed', $2, $4),
       ($1,'PCK-07','Operator Araci','vehicle','pickup','34 XYZ 789','Toyota','Hilux', 2022, 80, 'speed', $2, $5)
     RETURNING id, code`,
    [companyId, projectId, excavatorRate, truckRate, pickupRate],
  );
  const assetByCode = new Map(assets.map((a) => [a.code, a.id]));

  // --------------------------------------------------------------- cihaz
  const devices = await query<{ id: string; ident: string }>(
    `INSERT INTO devices
       (company_id, asset_id, kind, protocol, ident, sim_msisdn, model, utc_offset_minutes, installed_at)
     VALUES
       ($1,$2,'tracker','teltonika','356307042441013','+905321110001','FMB640', 0, now() - interval '60 days'),
       ($1,$2,'mdvr','jt808','013800138001','+905321110002','MDVR-4CH-4G', 480, now() - interval '60 days'),
       ($1,$3,'tracker','teltonika','356307042441021','+905321110003','FMB640', 0, now() - interval '55 days'),
       ($1,$4,'tracker','gt06','868120303444444','+905321110004','GT06N', 0, now() - interval '50 days'),
       ($1,$5,'tracker','gt06','868120303444555','+905321110005','GT06N', 0, now() - interval '45 days'),
       ($1,$5,'mdvr','jt808','013800138002','+905321110006','MDVR-2CH-4G', 480, now() - interval '45 days')
     RETURNING id, ident`,
    [
      companyId,
      assetByCode.get('EKS-01'),
      assetByCode.get('EKS-02'),
      assetByCode.get('KMY-01'),
      assetByCode.get('PCK-07'),
    ],
  );
  const deviceByIdent = new Map(devices.map((d) => [d.ident, d.id]));

  // --------------------------------------------------------------- kamera
  // Kabin kamerasi: privacy_class = high, event_only = true (canli izleme yok).
  await query(
    `INSERT INTO device_cameras
       (company_id, device_id, channel_no, position, label, records_audio, privacy_class,
        event_only, sd_recording)
     VALUES
       ($1,$2,1,'cabin','Kabin ici (olay bazli)', false, 'high',     true,  true),
       ($1,$2,2,'front','On - calisma sahasi',    false, 'standard', false, true),
       ($1,$2,3,'rear', 'Arka - manevra',         false, 'standard', false, true),
       ($1,$2,4,'boom', 'Bom / kova',             false, 'standard', false, true),
       ($1,$3,1,'cabin','Kabin ici (olay bazli)', false, 'high',     true,  true),
       ($1,$3,2,'vehicle_front','Arac on kamerasi', false,'standard',false, true)`,
    [companyId, deviceByIdent.get('013800138001'), deviceByIdent.get('013800138002')],
  );

  // ------------------------------------------------------------- geofence
  await query(
    `INSERT INTO geofences
       (company_id, project_id, name, kind, purpose, center_lat, center_lon, radius_m,
        polygon, hysteresis_m, color)
     VALUES
       ($1,$2,'Kartal Santiyesi','circle','worksite', 40.9100, 29.2100, 450, NULL, 50, '#16a34a'),
       ($1,NULL,'Merkez Depo','polygon','depot', NULL, NULL, NULL, $3, 40, '#2563eb'),
       ($1,NULL,'Yasakli Bolge - Okul Cevresi','circle','restricted', 40.9250, 29.1850, 200, NULL, 30, '#dc2626'),
       ($1,NULL,'Mahremiyet Bolgesi - Operator Ikametgahi','circle','privacy_zone', 40.9600, 29.1200, 300, NULL, 0, '#7c3aed')`,
    [
      companyId,
      projectId,
      JSON.stringify([
        { lat: 40.995, lon: 29.09 },
        { lat: 40.995, lon: 29.1 },
        { lat: 41.002, lon: 29.1 },
        { lat: 41.002, lon: 29.09 },
      ]),
    ],
  );

  // ------------------------------------------------------ operator atamasi
  await query(
    `INSERT INTO operator_assignments (company_id, asset_id, operator_id, starts_at, source, assigned_by)
     VALUES
       ($1,$2,$3, date_trunc('day', now()) + interval '6 hours', 'roster', $5),
       ($1,$4,$6, date_trunc('day', now()) + interval '6 hours', 'roster', $5)`,
    [
      companyId,
      assetByCode.get('EKS-01'),
      operator1,
      assetByCode.get('KMY-01'),
      dpoId,
      operator2,
    ],
  );

  // --------------------------------------------- mahremiyet pencereleri
  await query(
    `INSERT INTO privacy_windows (company_id, asset_id, kind, weekdays, start_time, end_time, note)
     VALUES
       ($1, NULL, 'break',     '{1,2,3,4,5}', '12:00', '13:00',
        'Ogle molasi - kamera erisimi kapali'),
       ($1, NULL, 'off_shift', NULL,          '19:00', '07:00',
        'Vardiya disi - yalnizca varlik guvenligi amaciyla dis kamera (cift onay)'),
       ($1, $2,   'private_use','{6,7}',      '00:00', '23:59',
        'Operator araci hafta sonu ozel kullanimda - konum kabalastirilir')`,
    [companyId, assetByCode.get('PCK-07')],
  );

  // ------------------------------------------------- KVKK aydinlatma metni
  const cameraNotice = await readNotice('aydinlatma-kamera.md', 'Kamera Sistemi Aydinlatma Metni');
  const locationNotice = await readNotice('aydinlatma-konum.md', 'Arac Takip Aydinlatma Metni');

  const notices = await query<{ id: string; kind: string }>(
    `INSERT INTO privacy_notices (company_id, kind, version, title, body_md, published_at)
     VALUES ($1,'camera','1.0',$2,$3, now()),
            ($1,'location','1.0',$4,$5, now())
     RETURNING id, kind`,
    [companyId, cameraNotice.title, cameraNotice.body, locationNotice.title, locationNotice.body],
  );

  // Operatorler metinleri teyit etmis olarak isaretlenir; teyit olmadan
  // kamera erisimi zaten reddedilir.
  for (const notice of notices) {
    for (const userId of [operator1, operator2]) {
      await query(
        `INSERT INTO notice_acknowledgements (company_id, notice_id, user_id, kind, granted, method)
         VALUES ($1,$2,$3,'ack',true,'wet_sign')
         ON CONFLICT DO NOTHING`,
        [companyId, notice.id, userId],
      );
    }
  }

  // ------------------------------------------------- saklama politikalari
  await query(
    `INSERT INTO retention_policies (company_id, data_type, retention_days, action, legal_basis)
     VALUES
       ($1,'camera_recording',   30,  'delete',    'Amacla sinirlilik - KVKK m.4'),
       ($1,'camera_event_clip',  180, 'delete',    'Kaza/sigorta sureci'),
       ($1,'cabin_event_clip',   90,  'delete',    'Olcululuk - en kisa sure'),
       ($1,'position',           365, 'delete',    'Operasyonel inceleme'),
       ($1,'work_session',       1825,'anonymize', 'Is hukuku zamanasimi - sure korunur, kisi koparilir'),
       ($1,'billing',            3650,'delete',    'VUK m.253, TTK m.82'),
       ($1,'audit_log',          730, 'delete',    'Hesap verebilirlik'),
       ($1,'fuel_event',         730, 'delete',    'Maliyet analizi'),
       ($1,'device_event',       730, 'delete',    'Bakim ve guvenlik')`,
    [companyId],
  );

  log('[seed] tamamlandi');
  log('[seed] ---------------------------------------------');
  log('[seed] Giris bilgileri (tum kullanicilar ayni parola):');
  log(`[seed]   parola: ${DEMO_PASSWORD}`);
  for (const user of users) {
    log(`[seed]   ${user.role.padEnd(11)} ${user.email}`);
  }
  log('[seed] ---------------------------------------------');
  log('[seed] Simulatoru baslatmak icin: npm run simulate');
}

const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seed()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed] hata:', error);
      process.exit(1);
    });
}
