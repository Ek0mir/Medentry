/**
 * KVKK kisitlarinin API seviyesinde dogrulanmasi.
 *
 * Bu testler "politika belgesi yazdik" ile "sistem gercekten engelliyor"
 * arasindaki farki kanitlar. Kural degistirildiginde bu testler kirilmalidir.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, databaseAvailable, resetTestDatabase, startTestServer } from './helpers.js';
import type { TestContext } from './helpers.js';

const available = await databaseAvailable();
const suite = available ? describe : describe.skip;

if (!available) {
  console.warn('[test] PostgreSQL erisilemedi, API testleri atlandi.');
}

suite('KVKK erisim politikasi (API)', () => {
  let ctx: TestContext;
  let assetId: string;
  let cabinCameraId: string;
  let frontCameraId: string;

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

    const cameras = await ctx.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/cameras`,
      headers: auth(ctx.tokens['manager']!),
    });
    const list = cameras.json() as Array<{ id: string; position: string }>;
    cabinCameraId = list.find((c) => c.position === 'cabin')!.id;
    frontCameraId = list.find((c) => c.position === 'front')!.id;
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  // -------------------------------------------------------------- kamera

  it('gecerli amac ve gerekce ile dis kamera acilir', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'is_guvenligi',
        reason: 'Santiye giris yolunda yayaya yaklasma ihbari inceleniyor',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { playbackUrl: string; obligations: string[]; audio: boolean };
    expect(body.playbackUrl).toContain('token=');
    expect(body.audio).toBe(false); // ses varsayilan kapali
    expect(body.obligations).toContain('notify_operator');
    expect(body.obligations).toContain('no_audio');
  });

  it('kabin kamerasi canli izlenemez', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: cabinCameraId,
        purpose: 'kaza_inceleme',
        reason: 'Kaza incelemesi kapsaminda kabin goruntusu talep ediliyor',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('CABIN_LIVE_FORBIDDEN');
  });

  it('kabin kaydi olay referansi olmadan acilamaz', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/playback',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: cabinCameraId,
        purpose: 'kaza_inceleme',
        reason: 'Devrilme olayinin nedeni arastiriliyor, kabin goruntusu gerekli',
        from: new Date(Date.now() - 600_000).toISOString(),
        to: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('CABIN_EVENT_REQUIRED');
  });

  it('amac disi erisim reddedilir (amacla sinirlilik)', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'hakedis_faturalama',
        reason: 'Hakedis kontrolu icin kamera goruntusune bakilmak isteniyor',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('PURPOSE_MISMATCH');
  });

  it('kisa gerekce kabul edilmez', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: { cameraId: frontCameraId, purpose: 'is_guvenligi', reason: 'kontrol' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('operator ve izleyici rolleri kamera acamaz', async () => {
    for (const role of ['operator', 'viewer'] as const) {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/api/media/live',
        headers: auth(ctx.tokens[role]!),
        payload: {
          cameraId: frontCameraId,
          purpose: 'is_guvenligi',
          reason: 'Yetkisiz rol ile kamera acma denemesi yapiliyor',
        },
      });
      expect(response.statusCode).toBe(403);
      expect((response.json() as { code: string }).code).toBe('ROLE_FORBIDDEN');
    }
  });

  it('gecersiz amac kodu reddedilir', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'merak',
        reason: 'Tanimsiz bir amac kodu ile erisim denemesi yapiliyor',
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('INVALID_PURPOSE');
  });

  // ------------------------------------------------------------ seffaflik

  it('izin verilen erisim operatore bildirilir', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: auth(ctx.tokens['operator']!),
    });

    const notifications = response.json() as Array<{ kind: string; body: string }>;
    const cameraNotice = notifications.find((n) => n.kind === 'camera_access');
    expect(cameraNotice).toBeDefined();
    expect(cameraNotice!.body).toContain('yaya'); // gerekce metni bildirimde
  });

  it('operator kendi erisim gecmisini gorur, baskasininkini gormez', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/kvkk/my-access-log',
      headers: auth(ctx.tokens['operator']!),
    });

    const rows = response.json() as Array<{ result: string; purposeLabel: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.purposeLabel).toBeTruthy();
  });

  // --------------------------------------------------------- denetim kaydi

  it('reddedilen erisimler de denetim kaydina yazilir', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/kvkk/audit?limit=500',
      headers: auth(ctx.tokens['dpo']!),
    });

    const rows = response.json() as Array<{ result: string; decision_code: string; reason: string | null }>;
    const denied = rows.filter((r) => r.result === 'deny');
    const allowed = rows.filter((r) => r.result === 'allow');

    expect(allowed.length).toBeGreaterThan(0);
    expect(denied.length).toBeGreaterThanOrEqual(3);
    expect(denied.map((r) => r.decision_code)).toContain('CABIN_LIVE_FORBIDDEN');
    expect(denied.map((r) => r.decision_code)).toContain('PURPOSE_MISMATCH');
  });

  it('denetim kaydini yalnizca yetkili roller gorur', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/kvkk/audit',
      headers: auth(ctx.tokens['operator']!),
    });
    expect(response.statusCode).toBe(403);
  });

  // --------------------------------------------------- mahremiyet penceresi

  it('mola saatinde kamera erisimi kapalidir', async () => {
    // Ogle molasi penceresi 12:00-13:00 (yerel). 12:30'da deneme yapiyoruz.
    const { pool } = await import('../src/db/pool.js');
    const now = new Date();
    const noon = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 30, 0),
    );

    // Pencereyi mutlak araliga cevirerek "su an mola" durumunu olusturuyoruz.
    await pool.query(
      `INSERT INTO privacy_windows (company_id, kind, starts_at, ends_at, note)
       SELECT id, 'break', $1, $2, 'test molasi' FROM companies LIMIT 1`,
      [new Date(Date.now() - 60_000), new Date(Date.now() + 3600_000)],
    );

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'is_guvenligi',
        reason: 'Mola saatinde kamera acilmaya calisiliyor - engellenmeli',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('PRIVACY_WINDOW');
    expect(noon).toBeInstanceOf(Date);

    await pool.query(`DELETE FROM privacy_windows WHERE note = 'test molasi'`);
  });

  // ---------------------------------------------------------- aydinlatma

  it('aydinlatma metnini teyit etmeyen operatorun kamerasi acilmaz', async () => {
    const { pool } = await import('../src/db/pool.js');
    // Operatorun kamera teyidini geri aliyoruz.
    await pool.query(
      `UPDATE notice_acknowledgements ack
          SET granted = false, withdrawn_at = now()
         FROM privacy_notices n
        WHERE n.id = ack.notice_id AND n.kind = 'camera'
          AND ack.user_id = (SELECT id FROM users WHERE email = 'operator1@ornek-firma.com.tr')`,
    );

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/media/live',
      headers: auth(ctx.tokens['manager']!),
      payload: {
        cameraId: frontCameraId,
        purpose: 'is_guvenligi',
        reason: 'Teyit alinmamis operator icin kamera acma denemesi yapiliyor',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { code: string }).code).toBe('NOTICE_NOT_ACKNOWLEDGED');

    // Teyidi geri veriyoruz.
    await pool.query(
      `UPDATE notice_acknowledgements SET granted = true, withdrawn_at = NULL
        WHERE user_id = (SELECT id FROM users WHERE email = 'operator1@ornek-firma.com.tr')`,
    );
  });

  it('ses kaydi acmak gerekce ister', async () => {
    const { pool } = await import('../src/db/pool.js');
    const device = await pool.query<{ id: string }>(
      `SELECT d.id FROM devices d WHERE d.kind = 'mdvr' LIMIT 1`,
    );

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/devices/${device.rows[0]!.id}/cameras`,
      headers: auth(ctx.tokens['manager']!),
      payload: { channelNo: 8, position: 'front', recordsAudio: true },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('AUDIO_JUSTIFICATION_REQUIRED');
  });

  it('kabin kamerasi tanimlanirken otomatik olarak yuksek mahremiyet sinifina girer', async () => {
    const { pool } = await import('../src/db/pool.js');
    const device = await pool.query<{ id: string }>(
      `SELECT d.id FROM devices d WHERE d.kind = 'mdvr' LIMIT 1`,
    );

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/devices/${device.rows[0]!.id}/cameras`,
      headers: auth(ctx.tokens['manager']!),
      payload: { channelNo: 9, position: 'cabin' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { privacyClass: string }).privacyClass).toBe('high');

    const row = await pool.query<{ event_only: boolean }>(
      `SELECT event_only FROM device_cameras WHERE device_id = $1 AND channel_no = 9`,
      [device.rows[0]!.id],
    );
    // Kabin kamerasi surekli degil, olay bazli kayit alir.
    expect(row.rows[0]!.event_only).toBe(true);
  });

  it('uyum panosu eksikleri raporlar', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/kvkk/compliance',
      headers: auth(ctx.tokens['dpo']!),
    });

    const body = response.json() as {
      score: number;
      checks: Array<{ code: string; ok: boolean }>;
    };
    expect(body.checks.find((c) => c.code === 'notice_published')?.ok).toBe(true);
    expect(body.checks.find((c) => c.code === 'no_audio')?.ok).toBe(true);
    expect(body.score).toBeGreaterThan(0);
  });
});
