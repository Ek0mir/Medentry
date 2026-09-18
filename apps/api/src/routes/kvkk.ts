/**
 * KVKK uclari.
 *
 * Bu uclar mevzuat yukumluluklerinin urun icindeki karsiligidir:
 *  - Aydinlatma metinleri ve personel teyidi (m.10)
 *  - Ilgili kisinin kendi verisine erisimi: "verime kim, ne zaman, neden
 *    eristi" (m.11)
 *  - Denetim kaydi ve veri guvenligi (m.12)
 *  - Basvuru yonetimi ve 30 gunluk cevap suresi (m.13)
 *  - Saklama ve imha (m.7)
 */

import type { FastifyInstance } from 'fastify';
import { PURPOSE_CATALOG, ROLE_LABELS } from '@medentry/shared';
import type { UserRole } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requireRole, requestMeta } from '../auth/context.js';
import { query, queryOne } from '../db/pool.js';
import { retentionSummary, runRetention } from '../jobs/retention.js';
import { limit as parseLimit, oneOf, optionalStr, str, uuid } from './validate.js';

const DPO_ROLES: UserRole[] = ['owner', 'dpo'];

export async function kvkkRoutes(app: FastifyInstance): Promise<void> {
  /** Isleme amaclari ve hukuki sebepleri (aydinlatma metninin ekidir). */
  app.get('/api/kvkk/purposes', { preHandler: requireAuth }, async () => {
    return Object.entries(PURPOSE_CATALOG).map(([code, info]) => ({
      code,
      label: info.label,
      legalBasis: info.legalBasis,
      description: info.description,
    }));
  });

  /** Yayimlanmis aydinlatma metinleri ve kullanicinin teyit durumu. */
  app.get('/api/kvkk/notices', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT n.id, n.kind, n.version, n.title, n.effective_from, n.published_at,
              (a.id IS NOT NULL) AS acknowledged, a.granted_at
         FROM privacy_notices n
         LEFT JOIN notice_acknowledgements a
                ON a.notice_id = n.id AND a.user_id = $2 AND a.granted AND a.withdrawn_at IS NULL
        WHERE n.company_id = $1 AND n.published_at IS NOT NULL
        ORDER BY n.kind, n.effective_from DESC`,
      [user.companyId, user.id],
    );
  });

  app.get('/api/kvkk/notices/:id', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const notice = await queryOne(
      `SELECT id, kind, version, title, body_md, effective_from, published_at
         FROM privacy_notices WHERE id = $1 AND company_id = $2`,
      [id, user.companyId],
    );
    if (!notice) throw new HttpError(404, 'Aydinlatma metni bulunamadi');
    return notice;
  });

  /**
   * Personelin aydinlatma metnini okudugunu teyidi.
   * Bu kayit olmadan kamera goruntusune erisim reddedilir.
   */
  app.post('/api/kvkk/notices/:id/acknowledge', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = (request.body ?? {}) as Record<string, unknown>;

    const notice = await queryOne<{ id: string }>(
      `SELECT id FROM privacy_notices WHERE id = $1 AND company_id = $2 AND published_at IS NOT NULL`,
      [id, user.companyId],
    );
    if (!notice) throw new HttpError(404, 'Aydinlatma metni bulunamadi');

    const kind = body['kind'] ? oneOf(body['kind'], ['ack', 'consent'] as const, 'kind') : 'ack';
    const method = body['method']
      ? oneOf(body['method'], ['app', 'wet_sign', 'kep', 'email'] as const, 'method')
      : 'app';

    await query(
      `INSERT INTO notice_acknowledgements (company_id, notice_id, user_id, kind, granted, method, ip)
       VALUES ($1,$2,$3,$4,true,$5,$6)
       ON CONFLICT (notice_id, user_id, kind) DO UPDATE
          SET granted = true, withdrawn_at = NULL, granted_at = now(), method = EXCLUDED.method`,
      [user.companyId, id, user.id, kind, method, meta.ip],
    );

    return { ok: true, acknowledgedAt: new Date().toISOString() };
  });

  /**
   * Acik rizanin geri alinmasi (m.7).
   * Riza gerektiren islemeler durur; mesru menfaat/sozlesme temelli
   * islemeler (konum, calisma saati) devam eder - bu ayrim kullaniciya
   * acikca bildirilir.
   */
  app.post('/api/kvkk/notices/:id/withdraw', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');

    const rows = await query<{ id: string }>(
      `UPDATE notice_acknowledgements
          SET withdrawn_at = now(), granted = false
        WHERE notice_id = $1 AND user_id = $2 AND kind = 'consent' AND withdrawn_at IS NULL
        RETURNING id`,
      [id, user.id],
    );

    return {
      ok: true,
      withdrawn: rows.length,
      note:
        'Acik rizaya dayali isleme durduruldu. Is sagligi ve guvenligi ile sozlesmenin ifasi ' +
        'kapsamindaki konum ve calisma saati kayitlari, hukuki dayanagi riza olmadigi icin devam eder.',
    };
  });

  /** Aydinlatma metni olusturma/yayimlama (KVKK irtibat kisisi). */
  app.post('/api/kvkk/notices', { preHandler: requireRole(...DPO_ROLES) }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const kind = oneOf(body['kind'], ['camera', 'location', 'general'] as const, 'kind');
    const version = str(body, 'version', { max: 20 });
    const title = str(body, 'title', { max: 200 });
    const bodyMd = str(body, 'bodyMd', { min: 100 });
    const publish = body['publish'] !== false;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO privacy_notices (company_id, kind, version, title, body_md, published_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id, kind, version) DO UPDATE
          SET title = EXCLUDED.title, body_md = EXCLUDED.body_md, published_at = EXCLUDED.published_at
       RETURNING id`,
      [user.companyId, kind, version, title, bodyMd, publish ? new Date() : null],
    );
    return { id: row?.id, published: publish };
  });

  /** Teyit durumu ozeti: kimler okudu, kimler okumadi. */
  app.get('/api/kvkk/acknowledgements', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT u.id AS user_id, u.full_name, u.role, u.employee_no,
              n.id AS notice_id, n.kind, n.version, n.title,
              a.granted_at, a.method, (a.id IS NOT NULL AND a.granted) AS acknowledged
         FROM users u
         CROSS JOIN privacy_notices n
         LEFT JOIN notice_acknowledgements a
                ON a.user_id = u.id AND a.notice_id = n.id AND a.withdrawn_at IS NULL
        WHERE u.company_id = $1 AND u.is_active
          AND n.company_id = $1 AND n.published_at IS NOT NULL
        ORDER BY acknowledged, u.full_name, n.kind`,
      [user.companyId],
    );
  });

  /**
   * Ilgili kisinin hakki (m.11): "Benim verime kim eristi?"
   * Operator kendi kaydini gorur; ustune baskasinin kaydini goremez.
   */
  app.get('/api/kvkk/my-access-log', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const rows = await query(
      `SELECT l.ts, l.action, l.data_type, l.purpose, l.reason, l.result,
              a.name AS asset_name, viewer.full_name AS viewer_name, viewer.role AS viewer_role
         FROM data_access_log l
         LEFT JOIN assets a ON a.id = l.asset_id
         LEFT JOIN users viewer ON viewer.id = l.user_id
        WHERE l.subject_user_id = $1
          AND l.data_type IN ('camera_live','camera_playback','recording_download')
        ORDER BY l.ts DESC
        LIMIT 200`,
      [user.id],
    );
    return rows.map((row) => ({
      ...row,
      purposeLabel: PURPOSE_CATALOG[row['purpose'] as keyof typeof PURPOSE_CATALOG]?.label ?? row['purpose'],
    }));
  });

  /** Bildirim kutusu (goruntunuz izlendi vb.). */
  app.get('/api/notifications', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT id, kind, title, body, created_at, read_at
         FROM notifications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 100`,
      [user.id],
    );
  });

  app.post('/api/notifications/:id/read', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    await query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`, [id, user.id]);
    return { ok: true };
  });

  /** Denetim kaydi (yalnizca yonetim ve KVKK irtibat kisisi). */
  app.get('/api/kvkk/audit', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);
    const q = request.query as Record<string, unknown>;
    const rows = await query(
      `SELECT l.id, l.ts, l.action, l.data_type, l.purpose, l.reason, l.result, l.decision_code,
              l.obligations, l.ip,
              viewer.full_name AS user_name, viewer.role AS user_role,
              subject.full_name AS subject_name,
              a.name AS asset_name, a.code AS asset_code
         FROM data_access_log l
         LEFT JOIN users viewer ON viewer.id = l.user_id
         LEFT JOIN users subject ON subject.id = l.subject_user_id
         LEFT JOIN assets a ON a.id = l.asset_id
        WHERE l.company_id = $1
          AND ($2::text IS NULL OR l.result = $2)
          AND ($3::uuid IS NULL OR l.asset_id = $3)
          AND ($4::uuid IS NULL OR l.user_id = $4)
        ORDER BY l.ts DESC
        LIMIT $5`,
      [
        user.companyId,
        typeof q['result'] === 'string' ? q['result'] : null,
        typeof q['assetId'] === 'string' ? q['assetId'] : null,
        typeof q['userId'] === 'string' ? q['userId'] : null,
        parseLimit(q['limit'], 200, 1000),
      ],
    );
    return rows;
  });

  /** Kamera izleme oturumlari - "kim ne kadar izledi" raporu. */
  app.get('/api/kvkk/media-sessions', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT m.id, m.mode, m.purpose, m.reason, m.started_at, m.ended_at,
              m.window_start, m.window_end, m.operator_notified_at,
              u.full_name AS viewer_name, u.role AS viewer_role,
              a.name AS asset_name, c.position AS camera_position, c.privacy_class
         FROM media_sessions m
         JOIN users u ON u.id = m.user_id
         JOIN assets a ON a.id = m.asset_id
         JOIN device_cameras c ON c.id = m.camera_id
        WHERE m.company_id = $1
        ORDER BY m.started_at DESC
        LIMIT 200`,
      [user.companyId],
    );
  });

  /** Mahremiyet pencereleri. */
  app.get('/api/kvkk/privacy-windows', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT w.id, w.asset_id, a.name AS asset_name, w.kind, w.weekdays,
              w.start_time::text, w.end_time::text, w.starts_at, w.ends_at, w.note, w.is_active
         FROM privacy_windows w
         LEFT JOIN assets a ON a.id = w.asset_id
        WHERE w.company_id = $1
        ORDER BY w.kind, w.start_time`,
      [user.companyId],
    );
  });

  app.post('/api/kvkk/privacy-windows', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const kind = oneOf(body['kind'], ['break', 'off_shift', 'private_use'] as const, 'kind');
    const assetId = body['assetId'] ? uuid(body['assetId'], 'assetId') : null;
    const weekdays = Array.isArray(body['weekdays']) ? (body['weekdays'] as number[]) : null;
    const startTime = optionalStr(body, 'startTime') ?? null;
    const endTime = optionalStr(body, 'endTime') ?? null;
    const startsAt = body['startsAt'] ? new Date(String(body['startsAt'])) : null;
    const endsAt = body['endsAt'] ? new Date(String(body['endsAt'])) : null;

    if (!startTime && !startsAt) {
      throw new HttpError(400, 'Gunluk saat araligi veya mutlak tarih araligi verilmelidir', 'WINDOW_RANGE');
    }

    const row = await queryOne<{ id: string }>(
      `INSERT INTO privacy_windows
         (company_id, asset_id, kind, weekdays, start_time, end_time, starts_at, ends_at, note)
       VALUES ($1,$2,$3,$4,$5::time,$6::time,$7,$8,$9)
       RETURNING id`,
      [
        user.companyId,
        assetId,
        kind,
        weekdays,
        startTime,
        endTime,
        startsAt,
        endsAt,
        optionalStr(body, 'note') ?? null,
      ],
    );
    return { id: row?.id };
  });

  app.delete('/api/kvkk/privacy-windows/:id', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    await query(`UPDATE privacy_windows SET is_active = false WHERE id = $1 AND company_id = $2`, [
      id,
      user.companyId,
    ]);
    return { ok: true };
  });

  /** Ilgili kisi basvurulari. */
  app.post('/api/kvkk/dsr', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const requestType = oneOf(
      body['requestType'],
      ['access', 'erasure', 'rectification', 'objection', 'restriction'] as const,
      'requestType',
    );
    const description = str(body, 'description', { min: 10, max: 4000 });

    const row = await queryOne<{ id: string; due_at: Date }>(
      `INSERT INTO dsr_requests (company_id, subject_user_id, subject_name, request_type, description)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, due_at`,
      [user.companyId, user.id, user.name, requestType, description],
    );

    return {
      id: row?.id,
      dueAt: row?.due_at,
      note: 'Basvurunuz kaydedildi. KVKK m.13 uyarinca en gec 30 gun icinde yanitlanacaktir.',
    };
  });

  app.get('/api/kvkk/dsr', { preHandler: requireRole('owner', 'dpo') }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT d.id, d.request_type, d.status, d.description, d.received_at, d.due_at,
              d.answered_at, d.answer, u.full_name AS subject_name, u.role AS subject_role,
              (d.due_at < now() AND d.status IN ('received','in_progress')) AS overdue
         FROM dsr_requests d
         LEFT JOIN users u ON u.id = d.subject_user_id
        WHERE d.company_id = $1
        ORDER BY d.received_at DESC`,
      [user.companyId],
    );
  });

  app.post('/api/kvkk/dsr/:id/answer', { preHandler: requireRole('owner', 'dpo') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = request.body as Record<string, unknown>;
    const answer = str(body, 'answer', { min: 10 });
    const status = body['status'] ? oneOf(body['status'], ['answered', 'rejected'] as const, 'status') : 'answered';

    const rows = await query<{ id: string }>(
      `UPDATE dsr_requests
          SET status = $3, answer = $4, answered_at = now(), handled_by = $5
        WHERE id = $1 AND company_id = $2
        RETURNING id`,
      [id, user.companyId, status, answer, user.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'Basvuru bulunamadi');
    return { ok: true };
  });

  /** Saklama/imha durumu ve elle calistirma. */
  app.get('/api/kvkk/retention', { preHandler: requireRole('owner', 'dpo') }, async (request) => {
    const user = currentUser(request);
    const policies = await query(
      `SELECT data_type, retention_days, action, legal_basis, last_run_at, last_run_deleted, is_active
         FROM retention_policies WHERE company_id = $1 ORDER BY data_type`,
      [user.companyId],
    );
    return { policies, summary: await retentionSummary(user.companyId) };
  });

  app.post('/api/kvkk/retention/run', { preHandler: requireRole('owner', 'dpo') }, async (request) => {
    const user = currentUser(request);
    const outcomes = await runRetention();
    return { outcomes: outcomes.filter((o) => o.companyId === user.companyId) };
  });

  /** Uyum panosu: KVKK irtibat kisisi icin tek bakista durum. */
  app.get('/api/kvkk/compliance', { preHandler: requireRole('owner', 'dpo', 'manager') }, async (request) => {
    const user = currentUser(request);

    const row = await queryOne<{
      users_total: number;
      users_acknowledged: number;
      notices_published: number;
      denied_last_30d: number;
      camera_views_last_30d: number;
      cabin_cameras: number;
      audio_cameras: number;
      privacy_windows: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active) AS users_total,
         (SELECT COUNT(DISTINCT a.user_id) FROM notice_acknowledgements a
            JOIN privacy_notices n ON n.id = a.notice_id
           WHERE n.company_id = $1 AND n.kind = 'camera' AND a.granted AND a.withdrawn_at IS NULL) AS users_acknowledged,
         (SELECT COUNT(*) FROM privacy_notices WHERE company_id = $1 AND published_at IS NOT NULL) AS notices_published,
         (SELECT COUNT(*) FROM data_access_log WHERE company_id = $1 AND result = 'deny' AND ts > now() - interval '30 days') AS denied_last_30d,
         (SELECT COUNT(*) FROM media_sessions WHERE company_id = $1 AND started_at > now() - interval '30 days') AS camera_views_last_30d,
         (SELECT COUNT(*) FROM device_cameras WHERE company_id = $1 AND position = 'cabin' AND is_active) AS cabin_cameras,
         (SELECT COUNT(*) FROM device_cameras WHERE company_id = $1 AND records_audio AND is_active) AS audio_cameras,
         (SELECT COUNT(*) FROM privacy_windows WHERE company_id = $1 AND is_active) AS privacy_windows`,
      [user.companyId],
    );

    const retention = await retentionSummary(user.companyId);
    const checks = [
      {
        code: 'notice_published',
        label: 'Kamera aydinlatma metni yayimlandi',
        ok: Number(row?.notices_published ?? 0) > 0,
        detail: `${row?.notices_published ?? 0} metin yayimda`,
      },
      {
        code: 'acknowledgement_coverage',
        label: 'Personel bilgilendirme teyidi tamam',
        ok: Number(row?.users_acknowledged ?? 0) >= Number(row?.users_total ?? 0),
        detail: `${row?.users_acknowledged ?? 0} / ${row?.users_total ?? 0} kullanici teyit etti`,
      },
      {
        code: 'no_audio',
        label: 'Ses kaydi kapali (olcululuk)',
        ok: Number(row?.audio_cameras ?? 0) === 0,
        detail:
          Number(row?.audio_cameras ?? 0) === 0
            ? 'Hicbir kamerada ses kaydi acik degil'
            : `${row?.audio_cameras} kamerada ses kaydi acik - gerekcelendirilmeli`,
      },
      {
        code: 'privacy_windows',
        label: 'Mola / vardiya disi mahremiyet penceresi tanimli',
        ok: Number(row?.privacy_windows ?? 0) > 0,
        detail: `${row?.privacy_windows ?? 0} pencere tanimli`,
      },
      {
        code: 'retention_applied',
        label: 'Saklama suresi dolan kayit birikmedi',
        ok: retention.recordingsPendingDeletion === 0,
        detail: `${retention.recordingsPendingDeletion} kayit imha bekliyor`,
      },
      {
        code: 'dsr_on_time',
        label: 'Ilgili kisi basvurulari suresinde',
        ok: retention.overdueDsrRequests === 0,
        detail: `${retention.overdueDsrRequests} basvuru suresi gecti`,
      },
    ];

    return {
      checks,
      score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100),
      stats: {
        usersTotal: Number(row?.users_total ?? 0),
        usersAcknowledged: Number(row?.users_acknowledged ?? 0),
        deniedLast30d: Number(row?.denied_last_30d ?? 0),
        cameraViewsLast30d: Number(row?.camera_views_last_30d ?? 0),
        cabinCameras: Number(row?.cabin_cameras ?? 0),
      },
      retention,
      roles: ROLE_LABELS,
    };
  });
}
