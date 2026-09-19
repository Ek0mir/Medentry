/**
 * Tek kullanici modu ve bagimsiz kayit cihazi davranislari.
 *
 * Kritik nokta: tek kullanici modu bir "kapat gitsin" anahtari degildir.
 * Makineye baska bir operator atandigi anda calisan koruma kurallari o kisi
 * icin kendiliginden geri gelmelidir. Asagidaki testler bunu kanitlar.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, databaseAvailable, resetTestDatabase, startTestServer } from './helpers.js';
import type { TestContext } from './helpers.js';

const available = await databaseAvailable();
const suite = available ? describe : describe.skip;

suite('tek kullanici modu ve kayit cihazi', () => {
  let ctx: TestContext;
  let assetId: string;
  let cabinCameraId: string;
  let frontCameraId: string;
  let ownerId: string;
  let operatorId: string;

  async function setSoloMode(enabled: boolean): Promise<void> {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: auth(ctx.tokens['owner']!),
      payload: { soloMode: enabled },
    });
    expect(response.statusCode).toBe(200);
  }

  /** Makineye atanmis operatoru degistirir (veya kaldirir). */
  async function assignOperator(userId: string | null): Promise<void> {
    const { pool } = await import('../src/db/pool.js');
    await pool.query(`DELETE FROM operator_assignments WHERE asset_id = $1`, [assetId]);
    if (userId) {
      await pool.query(
        `INSERT INTO operator_assignments (company_id, asset_id, operator_id, starts_at, source)
         SELECT company_id, id, $2, now() - interval '1 hour', 'manual' FROM assets WHERE id = $1`,
        [assetId, userId],
      );
    }
  }

  beforeAll(async () => {
    await resetTestDatabase();
    ctx = await startTestServer();

    const { pool } = await import('../src/db/pool.js');
    // Demo verisindeki mola/vardiya disi pencereleri kapatiyoruz: bu dosya
    // kabin ve gerekce kurallarini olcer ve testin gunun saatinden bagimsiz
    // calismasi gerekir. Pencere davranisi kendi testinde acikca kurulur.
    await pool.query(`UPDATE privacy_windows SET is_active = false`);

    const users = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email IN ($1, $2)`,
      ['sahip@ornek-firma.com.tr', 'operator1@ornek-firma.com.tr'],
    );
    ownerId = users.rows.find((u) => u.email.startsWith('sahip'))!.id;
    operatorId = users.rows.find((u) => u.email.startsWith('operator1'))!.id;

    // Sahip de aydinlatma metnini teyit etmis sayilir; boylece bu dosyadaki
    // testler teyit kuralina degil, olcmek istedikleri kurala takilir.
    await pool.query(
      `INSERT INTO notice_acknowledgements (company_id, notice_id, user_id, kind, granted, method)
       SELECT n.company_id, n.id, $1, 'ack', true, 'app' FROM privacy_notices n
       ON CONFLICT (notice_id, user_id, kind) DO NOTHING`,
      [ownerId],
    );

    const dashboard = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.tokens['owner']!),
    });
    const assets = (dashboard.json() as { assets: Array<{ id: string; code: string }> }).assets;
    assetId = assets.find((a) => a.code === 'EKS-01')!.id;

    const cameras = await ctx.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/cameras`,
      headers: auth(ctx.tokens['owner']!),
    });
    const list = cameras.json() as Array<{ id: string; position: string }>;
    cabinCameraId = list.find((c) => c.position === 'cabin')!.id;
    frontCameraId = list.find((c) => c.position === 'front')!.id;
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  // ------------------------------------------------------- kapali iken

  it('mod kapaliyken kabin kamerasi canli izlenemez', async () => {
    await setSoloMode(false);
    await assignOperator(ownerId);

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: {
        cameraId: cabinCameraId,
        purpose: 'is_guvenligi',
        reason: 'Kabin goruntusunu canli izlemeye calisiyorum, engellenmeli',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('CABIN_LIVE_FORBIDDEN');
  });

  // -------------------------------------------------------- acik iken

  it('mod acikken kisi kendi kabin goruntusunu canli izleyebilir', async () => {
    await setSoloMode(true);
    await assignOperator(ownerId);

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: cabinCameraId, purpose: 'is_guvenligi' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { playbackUrl: string; obligations: string[] };
    expect(body.playbackUrl).toContain('token=');
    // Kendine bildirim gonderilmez.
    expect(body.obligations).not.toContain('notify_operator');
  });

  it('mod acikken gerekce istenmez', async () => {
    await setSoloMode(true);
    await assignOperator(ownerId);

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: frontCameraId, purpose: 'is_guvenligi' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('mod acikken mola penceresi kamerayi kapatmaz', async () => {
    await setSoloMode(true);
    await assignOperator(ownerId);
    const { pool } = await import('../src/db/pool.js');
    await pool.query(
      `INSERT INTO privacy_windows (company_id, kind, starts_at, ends_at, note)
       SELECT id, 'break', $1, $2, 'solo testi molasi' FROM companies LIMIT 1`,
      [new Date(Date.now() - 60_000), new Date(Date.now() + 3600_000)],
    );

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: frontCameraId, purpose: 'is_guvenligi' },
    });

    expect(response.statusCode).toBe(200);
    await pool.query(`DELETE FROM privacy_windows WHERE note = 'solo testi molasi'`);
  });

  it('mod acik olsa da erisim denetim kaydina yazilir', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/kvkk/audit?limit=200',
      headers: auth(ctx.tokens['owner']!),
    });

    const rows = response.json() as Array<{ result: string; decision_code: string }>;
    expect(rows.some((r) => r.decision_code === 'ALLOWED_SOLO')).toBe(true);
  });

  // ------------------------------------- baska operator atandiginda geri doner

  it('makineye baska bir operator atanirsa korumalar geri gelir', async () => {
    await setSoloMode(true);
    // Makineyi artik baska bir calisan kullaniyor.
    await assignOperator(operatorId);

    const cabin = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: {
        cameraId: cabinCameraId,
        purpose: 'is_guvenligi',
        reason: 'Baska operator atanmisken kabin goruntusu talep ediliyor',
      },
    });
    expect(cabin.statusCode).toBe(403);
    expect((cabin.json() as { code: string }).code).toBe('CABIN_LIVE_FORBIDDEN');

    // Gerekce zorunlulugu da geri gelir.
    const noReason = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: frontCameraId, purpose: 'is_guvenligi' },
    });
    expect(noReason.statusCode).toBe(403);
    expect((noReason.json() as { code: string }).code).toBe('REASON_REQUIRED');
  });

  it('baska operator atanmisken erisim ona bildirilir', async () => {
    await setSoloMode(true);
    await assignOperator(operatorId);

    const allowed = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'is_guvenligi',
        reason: 'Santiyede calisma alanini kontrol etmek icin goruntu aciliyor',
      },
    });
    expect(allowed.statusCode).toBe(200);

    const notifications = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: auth(ctx.tokens['operator']!),
    });
    expect((notifications.json() as unknown[]).length).toBeGreaterThan(0);
  });

  it('amacla sinirlilik tek kullanici modunda da gecerlidir', async () => {
    await setSoloMode(true);
    await assignOperator(ownerId);

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: frontCameraId, purpose: 'hakedis_faturalama' },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('PURPOSE_MISMATCH');
  });

  // ------------------------------------------------ bagimsiz kayit cihazi

  it('bagimsiz kayit cihazindan canli yayin istenmez, aciklama doner', async () => {
    await setSoloMode(true);
    const { pool } = await import('../src/db/pool.js');
    await pool.query(`UPDATE device_cameras SET retrieval = 'manual' WHERE id = $1`, [frontCameraId]);

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['owner']!),
      payload: { cameraId: frontCameraId, purpose: 'is_guvenligi' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json() as { code: string; error: string };
    expect(body.code).toBe('MANUAL_RETRIEVAL');
    expect(body.error).toContain('SD karttan');

    await pool.query(`UPDATE device_cameras SET retrieval = 'integrated' WHERE id = $1`, [frontCameraId]);
  });

  it('olay icin SD kartta aranacak zaman araligini verir', async () => {
    const { pool } = await import('../src/db/pool.js');
    const eventAt = new Date('2026-09-18T11:32:15.000Z'); // 14:32:15 yerel
    const event = await pool.query<{ id: number }>(
      `INSERT INTO device_events (company_id, asset_id, ts, event_type, severity)
       SELECT company_id, id, $2, 'harsh_braking', 'warning' FROM assets WHERE id = $1
       RETURNING id`,
      [assetId, eventAt],
    );
    // Kayit cihazinin saati 90 sn ileri.
    await pool.query(
      `UPDATE devices SET clock_offset_sec = 90 WHERE asset_id = $1 AND kind = 'mdvr'`,
      [assetId],
    );

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/events/${event.rows[0]!.id}/clip-window`,
      headers: auth(ctx.tokens['owner']!),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      eventAt: string;
      windowFrom: string;
      windowTo: string;
      recorders: Array<{ searchFrom: string; searchTo: string; clockOffsetSec: number; note: string }>;
    };

    // Olay +/- 30 sn
    expect(new Date(body.windowFrom).toISOString()).toBe('2026-09-18T11:31:45.000Z');
    expect(new Date(body.windowTo).toISOString()).toBe('2026-09-18T11:32:45.000Z');

    const recorder = body.recorders[0]!;
    expect(recorder.clockOffsetSec).toBe(90);
    // Cihaz saati 90 sn ileri: 14:31:45 + 90 sn = 14:33:15
    expect(recorder.searchFrom).toContain('14:33:15');
    expect(recorder.searchTo).toContain('14:34:15');
    expect(recorder.note).toContain('ileri');
  });

  it('pencere istege bagli genisletilebilir', async () => {
    const { pool } = await import('../src/db/pool.js');
    const event = await pool.query<{ id: number }>(
      `SELECT id FROM device_events WHERE asset_id = $1 AND event_type = 'harsh_braking' LIMIT 1`,
      [assetId],
    );

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/events/${event.rows[0]!.id}/clip-window?beforeSec=120&afterSec=120`,
      headers: auth(ctx.tokens['owner']!),
    });

    const body = response.json() as { windowFrom: string; windowTo: string };
    const span = (new Date(body.windowTo).getTime() - new Date(body.windowFrom).getTime()) / 1000;
    expect(span).toBe(240);
  });

  // -------------------------------------------------- elle puantaj

  it('takip cihazi olmadan vardiya elle baslatilip bitirilebilir', async () => {
    const startedAt = new Date(Date.now() - 3 * 3600_000);

    const start = await ctx.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/sessions/start`,
      headers: auth(ctx.tokens['owner']!),
      payload: { startedAt: startedAt.toISOString() },
    });
    expect(start.statusCode).toBe(200);

    // Ikinci kez baslatilamaz.
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/sessions/start`,
      headers: auth(ctx.tokens['owner']!),
      payload: {},
    });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { code: string }).code).toBe('SESSION_ALREADY_OPEN');

    const stop = await ctx.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/sessions/stop`,
      headers: auth(ctx.tokens['owner']!),
      payload: { idleMinutes: 30 },
    });
    expect(stop.statusCode).toBe(200);
    const body = stop.json() as { durationSec: number; hours: number };
    expect(body.hours).toBeCloseTo(3, 1);

    const { pool } = await import('../src/db/pool.js');
    const session = await pool.query<{ idle_sec: number; working_sec: number; source: string }>(
      `SELECT idle_sec, working_sec, source FROM work_sessions
        WHERE asset_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [assetId],
    );
    expect(session.rows[0]!.source).toBe('manual');
    expect(session.rows[0]!.idle_sec).toBe(1800);
  });

  it('acik oturum yokken bitirme istegi anlasilir hata doner', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/sessions/stop`,
      headers: auth(ctx.tokens['owner']!),
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    expect((response.json() as { code: string }).code).toBe('NO_OPEN_SESSION');
  });

  // ------------------------------------------------ sensorsuz yakit

  it('sensor yoksa yakiti motor saatinden tahmin eder', async () => {
    const { pool } = await import('../src/db/pool.js');
    // Beyan edilen ortalama tuketim: 18 lt/saat
    await pool.query(`UPDATE assets SET nominal_consumption_lph = 18 WHERE id = $1`, [assetId]);

    const dateKey = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const recompute = await ctx.app.inject({
      method: 'POST',
      url: '/api/billing/recompute',
      headers: auth(ctx.tokens['owner']!),
      payload: { assetId, date: dateKey },
    });
    expect(recompute.statusCode).toBe(200);

    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/billing?from=${dateKey}&to=${dateKey}&assetId=${assetId}`,
      headers: auth(ctx.tokens['owner']!),
    });
    const row = (list.json() as { rows: Array<Record<string, number>> }).rows[0]!;

    // 3 saatlik elle oturumun 18 lt/saat karsiligi ~54 litre.
    expect(row['engineHours']).toBeGreaterThan(0);
    expect(row['fuelUsedLiters']).toBeCloseTo(row['engineHours']! * 18, 0);
  });

  it('yakit ozeti fis girisinden gercek tuketimi hesaplar', async () => {
    const add = await ctx.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/fuel-transactions`,
      headers: auth(ctx.tokens['owner']!),
      payload: { liters: 60, unitPrice: 46.5, station: 'Sahada tanker' },
    });
    expect(add.statusCode).toBe(200);

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/fuel`,
      headers: auth(ctx.tokens['owner']!),
    });

    const body = response.json() as {
      summary: {
        purchasedLiters: number;
        cost: number;
        engineHours: number;
        measuredLitersPerHour: number | null;
        costPerHour: number | null;
      };
    };

    expect(body.summary.purchasedLiters).toBe(60);
    expect(body.summary.cost).toBe(2790);
    expect(body.summary.engineHours).toBeGreaterThan(0);
    expect(body.summary.measuredLitersPerHour).toBeCloseTo(60 / body.summary.engineHours, 1);
    expect(body.summary.costPerHour).toBeGreaterThan(0);
  });
});
