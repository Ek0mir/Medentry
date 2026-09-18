/**
 * Telemetri -> oturum -> hakedis zincirinin uctan uca dogrulanmasi.
 *
 * Cihazdan gelen ham kayitlarin, faturalanabilir saate ve tutara nasil
 * donustugunu kanitlar. Hakedis hesabinda bir kayma olursa burada yakalanir.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, databaseAvailable, resetTestDatabase, startTestServer } from './helpers.js';
import type { TestContext } from './helpers.js';

const available = await databaseAvailable();
const suite = available ? describe : describe.skip;

const IMEI = '356307042441013';
const INGEST_KEY = process.env['INGEST_KEY'] ?? 'test-ingest-anahtari';

/** Yerel (UTC+3) saat/dakikadan UTC zaman damgasi uretir. */
function at(dayOffsetDays: number, hour: number, minute: number): Date {
  const now = new Date();
  const localMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 3600_000;
  return new Date(localMidnightUtc - dayOffsetDays * 86_400_000 + (hour * 60 + minute) * 60_000);
}

function dateKeyFor(dayOffsetDays: number): string {
  return new Date(at(dayOffsetDays, 12, 0).getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

interface RecordInput {
  ts: Date;
  ignition: boolean;
  rpm?: number;
  lat?: number;
  lon?: number;
  fuelPct?: number;
}

function record(input: RecordInput): Record<string, unknown> {
  return {
    deviceIdent: IMEI,
    protocol: 'teltonika',
    timestamp: input.ts.toISOString(),
    position: { lat: input.lat ?? 40.91, lon: input.lon ?? 29.21 },
    gpsValid: true,
    speedKph: 0,
    ignition: input.ignition,
    engineRpm: input.rpm,
    fuelLevelPct: input.fuelPct,
  };
}

suite('telemetri -> oturum -> hakedis', () => {
  let ctx: TestContext;
  let assetId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    ctx = await startTestServer();

    const dashboard = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.tokens['manager']!),
    });
    const assets = (dashboard.json() as { assets: Array<{ id: string; code: string }> }).assets;
    assetId = assets.find((a) => a.code === 'EKS-01')!.id;

    // Dun 07:00 - 12:00 kazi (araya 30 dk rolanti), 13:00 - 17:00 kazi.
    const records: Array<Record<string, unknown>> = [];
    let fuel = 90;
    for (let minute = 7 * 60; minute < 12 * 60; minute += 5) {
      const idle = minute >= 9 * 60 + 30 && minute < 10 * 60;
      fuel -= 0.05;
      records.push(
        record({ ts: at(1, 0, minute), ignition: true, rpm: idle ? 750 : 1600, fuelPct: fuel }),
      );
    }
    records.push(record({ ts: at(1, 12, 0), ignition: false, fuelPct: fuel }));
    for (let minute = 13 * 60; minute < 17 * 60; minute += 5) {
      fuel -= 0.05;
      records.push(record({ ts: at(1, 0, minute), ignition: true, rpm: 1600, fuelPct: fuel }));
    }
    records.push(record({ ts: at(1, 17, 0), ignition: false, fuelPct: fuel }));

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/ingest/decoded',
      headers: { 'x-ingest-key': INGEST_KEY },
      payload: { records },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { accepted: number }).accepted).toBe(records.length);
  }, 90_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it('kontak gecislerinden iki oturum uretir', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/sessions?from=${at(2, 0, 0).toISOString()}`,
      headers: auth(ctx.tokens['manager']!),
    });

    const sessions = response.json() as Array<{
      duration_sec: number;
      idle_sec: number;
      working_sec: number;
      is_open: boolean;
    }>;

    expect(sessions).toHaveLength(2);
    const [second, first] = sessions; // en yeni once
    expect(first!.duration_sec).toBe(5 * 3600); // 07:00 - 12:00
    expect(first!.idle_sec).toBe(30 * 60); // 09:30 - 10:00 rolanti
    expect(first!.working_sec).toBe(4.5 * 3600);
    expect(second!.duration_sec).toBe(4 * 3600); // 13:00 - 17:00
    expect(second!.is_open).toBe(false);
  });

  it('tanimsiz cihazdan gelen veriyi kaydetmez', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/ingest/decoded',
      headers: { 'x-ingest-key': INGEST_KEY },
      payload: {
        records: [
          {
            deviceIdent: '999999999999999',
            protocol: 'gt06',
            timestamp: new Date().toISOString(),
            gpsValid: false,
          },
        ],
      },
    });

    const body = response.json() as { accepted: number; skipped: number; unknownDevices: string[] };
    expect(body.accepted).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.unknownDevices).toContain('999999999999999');
  });

  it('ingest anahtari olmadan veri kabul edilmez', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/ingest/decoded',
      payload: { records: [] },
    });
    expect(response.statusCode).toBe(401);
  });

  it('gunluk hakedisi tarife kartina gore hesaplar', async () => {
    const date = dateKeyFor(1);
    const recompute = await ctx.app.inject({
      method: 'POST',
      url: '/api/billing/recompute',
      headers: auth(ctx.tokens['manager']!),
      payload: { assetId, date },
    });
    expect(recompute.statusCode).toBe(200);

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/billing?from=${date}&to=${date}&assetId=${assetId}`,
      headers: auth(ctx.tokens['manager']!),
    });

    const rows = (response.json() as { rows: Array<Record<string, number | string>> }).rows;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;

    // 9 saat motor, 0.5 saat rolanti -> 8.5 saat efektif calisma.
    expect(row['engineHours']).toBe(9);
    expect(row['idleHours']).toBe(0.5);
    expect(row['workingHours']).toBe(8.5);
    // Tarife: rolanti faturalanmaz, 15 dk yukari yuvarlama, 9 saat ustu mesai.
    expect(row['billableHours']).toBe(8.5);
    expect(row['overtimeHours']).toBe(0);
    // 8.5 x 1850 = 15.725 TL calisma + 6.500 TL nakliye + rolanti (0.5 x 550)
    expect(row['amountBase']).toBe(15_725);
    expect(row['amountTransport']).toBe(6500);
    expect(row['amountIdle']).toBe(275);
  });

  it('onaylanan hakedis yeniden hesaplanamaz', async () => {
    const date = dateKeyFor(1);
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/billing?from=${date}&to=${date}&assetId=${assetId}`,
      headers: auth(ctx.tokens['manager']!),
    });
    const id = (list.json() as { rows: Array<{ id: string }> }).rows[0]!.id;

    const approve = await ctx.app.inject({
      method: 'POST',
      url: `/api/billing/${id}/approve`,
      headers: auth(ctx.tokens['siteChief']!),
    });
    expect(approve.statusCode).toBe(200);

    const recompute = await ctx.app.inject({
      method: 'POST',
      url: '/api/billing/recompute',
      headers: auth(ctx.tokens['manager']!),
      payload: { assetId, date },
    });
    expect(recompute.statusCode).toBe(409);
    expect((recompute.json() as { code: string }).code).toBe('BILLING_LOCKED');
  });

  it('operator hakedis onaylayamaz', async () => {
    const date = dateKeyFor(1);
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/billing?from=${date}&to=${date}&assetId=${assetId}`,
      headers: auth(ctx.tokens['manager']!),
    });
    const id = (list.json() as { rows: Array<{ id: string }> }).rows[0]!.id;

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/billing/${id}/approve`,
      headers: auth(ctx.tokens['operator']!),
    });
    expect(response.statusCode).toBe(403);
  });

  it('tek ekran verisi calisma ve hakedis bilgisini birlikte dondurur', async () => {
    const date = dateKeyFor(1);
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/dashboard/${assetId}?date=${date}`,
      headers: auth(ctx.tokens['manager']!),
    });

    const body = response.json() as {
      asset: {
        today: { engineHours: number; idleHours: number; firstStartAt: string | null };
        operator: { name: string } | null;
        cameras: Array<{ position: string; liveAllowed: boolean }>;
      };
      billing: { billableHours: number; amountTotal: number } | null;
      sessions: unknown[];
      track: unknown[];
    };

    expect(body.asset.today.engineHours).toBe(9);
    expect(body.asset.today.idleHours).toBe(0.5);
    expect(body.asset.today.firstStartAt).toBeTruthy();
    expect(body.asset.operator?.name).toBe('Ali Ozturk');
    expect(body.sessions).toHaveLength(2);
    expect(body.track.length).toBeGreaterThan(0);
    expect(body.billing?.billableHours).toBe(8.5);

    // Kabin kamerasi arayuzde de "canli izlenemez" olarak isaretlenir.
    const cabin = body.asset.cameras.find((c) => c.position === 'cabin');
    expect(cabin?.liveAllowed).toBe(false);
  });

  it('mahremiyet bolgesindeki konumlar gecmis sorgusundan cikarilir', async () => {
    const { pool } = await import('../src/db/pool.js');
    // Mahremiyet bolgesi icinde bir konum ekliyoruz (seed: 40.96, 29.12).
    await pool.query(
      `INSERT INTO positions (company_id, asset_id, ts, lat, lon, gps_valid, speed_kph)
       SELECT company_id, id, $1, 40.96, 29.12, true, 0 FROM assets WHERE id = $2`,
      [at(1, 20, 0), assetId],
    );

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/positions?from=${at(2, 0, 0).toISOString()}&to=${new Date().toISOString()}`,
      headers: auth(ctx.tokens['manager']!),
    });

    const body = response.json() as { points: Array<{ lat: number }>; masked: number };
    expect(body.masked).toBeGreaterThanOrEqual(1);
    expect(body.points.some((p) => Math.abs(p.lat - 40.96) < 0.001)).toBe(false);
  });
});
