/**
 * Filo yonetimi uclari: varliklar, cihazlar, geofence, operator atamalari,
 * oturum gecmisi, olaylar ve yakit.
 */

import type { FastifyInstance } from 'fastify';
import { ASSET_TYPE_LABELS } from '@medentry/shared';
import type { AssetType } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requireRole, requestMeta } from '../auth/context.js';
import { query, queryOne } from '../db/pool.js';
import { guardAccess } from '../kvkk/guard.js';
import { clearPipelineCaches } from '../pipeline/ingest.js';
import {
  bool,
  date,
  limit as parseLimit,
  num,
  oneOf,
  optionalNum,
  optionalStr,
  str,
  uuid,
} from './validate.js';

const ASSET_TYPES = Object.keys(ASSET_TYPE_LABELS) as AssetType[];

export async function fleetRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Varliklar
  // -------------------------------------------------------------------------

  app.get('/api/assets', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT a.id, a.code, a.name, a.category, a.asset_type, a.plate, a.make, a.model,
              a.model_year, a.fuel_tank_liters, a.idle_strategy, a.is_active,
              p.name AS project_name, r.name AS rate_card_name,
              (SELECT COUNT(*) FROM devices d WHERE d.asset_id = a.id AND d.is_active) AS device_count,
              (SELECT COUNT(*) FROM device_cameras c JOIN devices d2 ON d2.id = c.device_id
                WHERE d2.asset_id = a.id AND c.is_active) AS camera_count
         FROM assets a
         LEFT JOIN projects p ON p.id = a.project_id
         LEFT JOIN rate_cards r ON r.id = a.rate_card_id
        WHERE a.company_id = $1
        ORDER BY a.is_active DESC, a.code`,
      [user.companyId],
    );
  });

  app.post('/api/assets', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO assets
         (company_id, code, name, category, asset_type, plate, make, model, model_year,
          fuel_tank_liters, idle_strategy, project_id, rate_card_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        user.companyId,
        str(body, 'code', { max: 40 }),
        str(body, 'name', { max: 120 }),
        oneOf(body['category'], ['machine', 'vehicle'] as const, 'category'),
        oneOf(body['assetType'], ASSET_TYPES, 'assetType'),
        optionalStr(body, 'plate') ?? null,
        optionalStr(body, 'make') ?? null,
        optionalStr(body, 'model') ?? null,
        optionalNum(body, 'modelYear') ?? null,
        optionalNum(body, 'fuelTankLiters') ?? null,
        body['idleStrategy']
          ? oneOf(body['idleStrategy'], ['auto', 'speed', 'rpm', 'movement'] as const, 'idleStrategy')
          : 'auto',
        body['projectId'] ? uuid(body['projectId'], 'projectId') : null,
        body['rateCardId'] ? uuid(body['rateCardId'], 'rateCardId') : null,
      ],
    );
    clearPipelineCaches();
    return { id: row?.id };
  });

  app.patch('/api/assets/:id', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = request.body as Record<string, unknown>;

    const rows = await query<{ id: string }>(
      `UPDATE assets SET
         name = COALESCE($3, name),
         plate = COALESCE($4, plate),
         fuel_tank_liters = COALESCE($5, fuel_tank_liters),
         idle_strategy = COALESCE($6, idle_strategy),
         project_id = COALESCE($7, project_id),
         rate_card_id = COALESCE($8, rate_card_id),
         is_active = COALESCE($9, is_active)
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [
        id,
        user.companyId,
        optionalStr(body, 'name') ?? null,
        optionalStr(body, 'plate') ?? null,
        optionalNum(body, 'fuelTankLiters') ?? null,
        body['idleStrategy']
          ? oneOf(body['idleStrategy'], ['auto', 'speed', 'rpm', 'movement'] as const, 'idleStrategy')
          : null,
        body['projectId'] ? uuid(body['projectId'], 'projectId') : null,
        body['rateCardId'] ? uuid(body['rateCardId'], 'rateCardId') : null,
        body['isActive'] === undefined ? null : bool(body, 'isActive', true),
      ],
    );
    if (rows.length === 0) throw new HttpError(404, 'Varlik bulunamadi');
    clearPipelineCaches();
    return { ok: true };
  });

  /** Konum gecmisi. */
  app.get('/api/assets/:id/positions', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const q = request.query as Record<string, unknown>;
    const from = date(q['from'] ?? new Date(Date.now() - 86_400_000), 'from');
    const to = date(q['to'] ?? new Date(), 'to');

    const guard = await guardAccess({
      user,
      purpose: typeof q['purpose'] === 'string' ? q['purpose'] : 'operasyon_yonetimi',
      dataType: 'position_history',
      action: 'position_history',
      assetId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      auditThrottleMs: 5 * 60_000,
    });

    const rows = await query<{ ts: Date; lat: number; lon: number; speed_kph: number; ignition: boolean }>(
      `SELECT ts, lat, lon, speed_kph, ignition
         FROM positions
        WHERE asset_id = $1 AND company_id = $2 AND ts >= $3 AND ts <= $4 AND lat IS NOT NULL
        ORDER BY ts
        LIMIT $5`,
      [id, user.companyId, from, to, parseLimit(q['limit'], 2000, 20_000)],
    );

    // Mahremiyet bolgelerinde konum maskelenir.
    const privacyZones = await query<{ center_lat: number; center_lon: number; radius_m: number }>(
      `SELECT center_lat, center_lon, radius_m FROM geofences
        WHERE company_id = $1 AND purpose = 'privacy_zone' AND is_active AND kind = 'circle'`,
      [user.companyId],
    );

    const coarse = guard.decision.obligations.includes('coarse_location_only');
    const points = rows
      .map((row) => {
        const inZone = privacyZones.some(
          (z) =>
            z.center_lat !== null &&
            haversine(row.lat, row.lon, z.center_lat, z.center_lon) <= (z.radius_m ?? 0),
        );
        if (inZone) return null; // mahremiyet bolgesi: nokta hic gonderilmez
        return {
          ts: row.ts,
          lat: coarse ? Math.round(row.lat * 100) / 100 : row.lat,
          lon: coarse ? Math.round(row.lon * 100) / 100 : row.lon,
          speedKph: row.speed_kph,
          ignition: row.ignition,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return { points, masked: rows.length - points.length, coarse };
  });

  /** Oturum gecmisi (puantaj). */
  app.get('/api/assets/:id/sessions', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const q = request.query as Record<string, unknown>;

    return query(
      `SELECT ws.id, ws.started_at, ws.ended_at, ws.duration_sec, ws.idle_sec, ws.working_sec,
              ws.distance_m, ws.fuel_used_liters, ws.is_open, ws.source, ws.note,
              u.full_name AS operator_name
         FROM work_sessions ws
         LEFT JOIN users u ON u.id = ws.operator_id
        WHERE ws.asset_id = $1 AND ws.company_id = $2
          AND ws.started_at >= $3
        ORDER BY ws.started_at DESC
        LIMIT $4`,
      [
        id,
        user.companyId,
        date(q['from'] ?? new Date(Date.now() - 7 * 86_400_000), 'from'),
        parseLimit(q['limit'], 100, 500),
      ],
    );
  });

  /** Olaylar / alarmlar. */
  app.get('/api/assets/:id/events', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const q = request.query as Record<string, unknown>;

    return query(
      `SELECT id, ts, event_type, severity, lat, lon, payload, clip_requested, acknowledged_at
         FROM device_events
        WHERE asset_id = $1 AND company_id = $2 AND ts >= $3
          AND ($4::text IS NULL OR severity = $4)
        ORDER BY ts DESC
        LIMIT $5`,
      [
        id,
        user.companyId,
        date(q['from'] ?? new Date(Date.now() - 7 * 86_400_000), 'from'),
        typeof q['severity'] === 'string' ? q['severity'] : null,
        parseLimit(q['limit'], 100, 500),
      ],
    );
  });

  app.post('/api/events/:id/acknowledge', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = Number((request.params as Record<string, unknown>)['id']);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Gecersiz olay kimligi');

    await query(
      `UPDATE device_events SET acknowledged_by = $3, acknowledged_at = now()
        WHERE id = $1 AND company_id = $2`,
      [id, user.companyId, user.id],
    );
    return { ok: true };
  });

  /** Yakit olaylari ve alimlari. */
  app.get('/api/assets/:id/fuel', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const q = request.query as Record<string, unknown>;
    const from = date(q['from'] ?? new Date(Date.now() - 30 * 86_400_000), 'from');

    await guardAccess({
      user,
      purpose: 'varlik_guvenligi',
      dataType: 'fuel',
      action: 'fuel_list',
      assetId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      auditThrottleMs: 15 * 60_000,
    });

    const [events, transactions] = await Promise.all([
      query(
        `SELECT id, ts, kind, liters, level_before_pct, level_after_pct, lat, lon, confidence
           FROM fuel_events
          WHERE asset_id = $1 AND company_id = $2 AND ts >= $3
          ORDER BY ts DESC LIMIT 200`,
        [id, user.companyId, from],
      ),
      query(
        `SELECT ft.id, ft.ts, ft.liters, ft.unit_price, ft.total, ft.station, ft.receipt_no,
                u.full_name AS entered_by_name
           FROM fuel_transactions ft
           LEFT JOIN users u ON u.id = ft.entered_by
          WHERE ft.asset_id = $1 AND ft.company_id = $2 AND ft.ts >= $3
          ORDER BY ft.ts DESC LIMIT 200`,
        [id, user.companyId, from],
      ),
    ]);

    return { events, transactions };
  });

  app.post('/api/assets/:id/fuel-transactions', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = request.body as Record<string, unknown>;
    const liters = num(body, 'liters', { min: 0.1, max: 5000 });
    const unitPrice = optionalNum(body, 'unitPrice');

    const row = await queryOne<{ id: string }>(
      `INSERT INTO fuel_transactions
         (company_id, asset_id, ts, liters, unit_price, total, station, receipt_no, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        user.companyId,
        id,
        date(body['ts'] ?? new Date(), 'ts'),
        liters,
        unitPrice ?? null,
        unitPrice ? Math.round(liters * unitPrice * 100) / 100 : null,
        optionalStr(body, 'station') ?? null,
        optionalStr(body, 'receiptNo') ?? null,
        user.id,
      ],
    );
    return { id: row?.id };
  });

  // -------------------------------------------------------------------------
  // Cihazlar
  // -------------------------------------------------------------------------

  app.get('/api/devices', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT d.id, d.ident, d.kind, d.protocol, d.model, d.sim_msisdn, d.utc_offset_minutes,
              d.last_seen_at, d.is_active, a.code AS asset_code, a.name AS asset_name,
              (SELECT COUNT(*) FROM device_cameras c WHERE c.device_id = d.id AND c.is_active) AS camera_count
         FROM devices d
         LEFT JOIN assets a ON a.id = d.asset_id
        WHERE d.company_id = $1
        ORDER BY d.is_active DESC, a.code NULLS LAST, d.ident`,
      [user.companyId],
    );
  });

  app.post('/api/devices', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO devices
         (company_id, asset_id, kind, protocol, ident, sim_msisdn, model, utc_offset_minutes, installed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (ident) DO UPDATE
          SET asset_id = EXCLUDED.asset_id, kind = EXCLUDED.kind, protocol = EXCLUDED.protocol,
              is_active = true
       RETURNING id`,
      [
        user.companyId,
        body['assetId'] ? uuid(body['assetId'], 'assetId') : null,
        oneOf(body['kind'], ['tracker', 'mdvr', 'ipcam'] as const, 'kind'),
        oneOf(body['protocol'], ['gt06', 'teltonika', 'jt808', 'generic'] as const, 'protocol'),
        str(body, 'ident', { max: 40 }),
        optionalStr(body, 'simMsisdn') ?? null,
        optionalStr(body, 'model') ?? null,
        optionalNum(body, 'utcOffsetMinutes') ?? 0,
      ],
    );
    clearPipelineCaches();
    return { id: row?.id };
  });

  /**
   * Kamera tanimi.
   * Kabin kamerasi otomatik olarak "yuksek mahremiyet" ve "olay bazli" olarak
   * isaretlenir; ses kaydi acikca gerekcelendirilmeden acilamaz.
   */
  app.post('/api/devices/:id/cameras', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const deviceId = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = request.body as Record<string, unknown>;
    const position = oneOf(
      body['position'],
      ['cabin', 'front', 'rear', 'left', 'right', 'boom', 'vehicle_front'] as const,
      'position',
    );
    const recordsAudio = bool(body, 'recordsAudio', false);

    if (recordsAudio && !optionalStr(body, 'audioJustification')) {
      throw new HttpError(
        400,
        'Ses kaydi acmak icin gerekce (audioJustification) zorunludur. KVKK olcululuk ilkesi geregi ' +
          'ses kaydi varsayilan olarak kapalidir.',
        'AUDIO_JUSTIFICATION_REQUIRED',
      );
    }

    const row = await queryOne<{ id: string }>(
      `INSERT INTO device_cameras
         (company_id, device_id, channel_no, position, label, records_audio, privacy_class,
          event_only, sd_recording)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (device_id, channel_no) DO UPDATE
          SET position = EXCLUDED.position, label = EXCLUDED.label,
              records_audio = EXCLUDED.records_audio, privacy_class = EXCLUDED.privacy_class,
              event_only = EXCLUDED.event_only, is_active = true
       RETURNING id`,
      [
        user.companyId,
        deviceId,
        num(body, 'channelNo', { min: 1, max: 32 }),
        position,
        optionalStr(body, 'label') ?? null,
        recordsAudio,
        position === 'cabin' ? 'high' : 'standard',
        // Kabin kamerasi surekli degil, yalnizca olay aninda kayit alir.
        position === 'cabin' ? true : bool(body, 'eventOnly', false),
        bool(body, 'sdRecording', true),
      ],
    );
    return { id: row?.id, privacyClass: position === 'cabin' ? 'high' : 'standard' };
  });

  // -------------------------------------------------------------------------
  // Geofence
  // -------------------------------------------------------------------------

  app.get('/api/geofences', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT id, name, kind, purpose, center_lat, center_lon, radius_m, polygon,
              hysteresis_m, color, is_active
         FROM geofences WHERE company_id = $1 ORDER BY purpose, name`,
      [user.companyId],
    );
  });

  app.post('/api/geofences', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const kind = oneOf(body['kind'], ['circle', 'polygon'] as const, 'kind');
    const purpose = oneOf(
      body['purpose'],
      ['worksite', 'depot', 'restricted', 'privacy_zone', 'customer'] as const,
      'purpose',
    );

    if (kind === 'circle' && (body['centerLat'] === undefined || body['radiusM'] === undefined)) {
      throw new HttpError(400, 'Daire cit icin merkez ve yaricap zorunludur', 'GEOFENCE_CIRCLE');
    }
    if (kind === 'polygon' && !Array.isArray(body['polygon'])) {
      throw new HttpError(400, 'Poligon cit icin kose noktalari zorunludur', 'GEOFENCE_POLYGON');
    }

    const row = await queryOne<{ id: string }>(
      `INSERT INTO geofences
         (company_id, project_id, name, kind, purpose, center_lat, center_lon, radius_m,
          polygon, hysteresis_m, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        user.companyId,
        body['projectId'] ? uuid(body['projectId'], 'projectId') : null,
        str(body, 'name', { max: 120 }),
        kind,
        purpose,
        optionalNum(body, 'centerLat') ?? null,
        optionalNum(body, 'centerLon') ?? null,
        optionalNum(body, 'radiusM') ?? null,
        kind === 'polygon' ? JSON.stringify(body['polygon']) : null,
        optionalNum(body, 'hysteresisM') ?? 50,
        optionalStr(body, 'color') ?? '#2563eb',
      ],
    );
    clearPipelineCaches();
    return { id: row?.id };
  });

  app.delete('/api/geofences/:id', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    await query(`UPDATE geofences SET is_active = false WHERE id = $1 AND company_id = $2`, [
      id,
      user.companyId,
    ]);
    clearPipelineCaches();
    return { ok: true };
  });

  app.get('/api/assets/:id/geofence-events', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const q = request.query as Record<string, unknown>;
    return query(
      `SELECT ge.ts, ge.kind, g.name AS geofence_name, g.purpose
         FROM geofence_events ge
         JOIN geofences g ON g.id = ge.geofence_id
        WHERE ge.asset_id = $1 AND ge.company_id = $2 AND ge.ts >= $3
        ORDER BY ge.ts DESC LIMIT 200`,
      [id, user.companyId, date(q['from'] ?? new Date(Date.now() - 7 * 86_400_000), 'from')],
    );
  });

  // -------------------------------------------------------------------------
  // Operator atamalari - "makineyi kim kullaniyor"
  // -------------------------------------------------------------------------

  app.get('/api/operators', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT u.id, u.full_name, u.employee_no, u.phone, u.is_active,
              oa.asset_id AS current_asset_id, a.code AS current_asset_code
         FROM users u
         LEFT JOIN LATERAL (
           SELECT asset_id FROM operator_assignments
            WHERE operator_id = u.id AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
            ORDER BY starts_at DESC LIMIT 1
         ) oa ON true
         LEFT JOIN assets a ON a.id = oa.asset_id
        WHERE u.company_id = $1 AND u.role = 'operator'
        ORDER BY u.full_name`,
      [user.companyId],
    );
  });

  app.post('/api/assignments', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const assetId = uuid(body['assetId'], 'assetId');
    const operatorId = uuid(body['operatorId'], 'operatorId');
    const startsAt = date(body['startsAt'] ?? new Date(), 'startsAt');
    const endsAt = body['endsAt'] ? date(body['endsAt'], 'endsAt') : null;

    // Ayni anda iki makineye atama olmamasi icin onceki acik atama kapatilir.
    await query(
      `UPDATE operator_assignments SET ends_at = $2
        WHERE operator_id = $1 AND ends_at IS NULL AND starts_at < $2`,
      [operatorId, startsAt],
    );

    const row = await queryOne<{ id: string }>(
      `INSERT INTO operator_assignments
         (company_id, asset_id, operator_id, starts_at, ends_at, source, assigned_by, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        user.companyId,
        assetId,
        operatorId,
        startsAt,
        endsAt,
        body['source'] ? oneOf(body['source'], ['roster', 'ibutton', 'manual', 'app'] as const, 'source') : 'manual',
        user.id,
        optionalStr(body, 'note') ?? null,
      ],
    );

    // Acik oturum varsa operatorunu guncelle.
    await query(
      `UPDATE work_sessions SET operator_id = $2, updated_at = now()
        WHERE asset_id = $1 AND is_open AND operator_id IS NULL`,
      [assetId, operatorId],
    );

    return { id: row?.id };
  });

  app.get('/api/assets/:id/assignments', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    return query(
      `SELECT oa.id, oa.starts_at, oa.ends_at, oa.source, oa.note,
              u.full_name AS operator_name, u.employee_no, u.phone,
              assigner.full_name AS assigned_by_name
         FROM operator_assignments oa
         JOIN users u ON u.id = oa.operator_id
         LEFT JOIN users assigner ON assigner.id = oa.assigned_by
        WHERE oa.asset_id = $1 AND oa.company_id = $2
        ORDER BY oa.starts_at DESC LIMIT 100`,
      [id, user.companyId],
    );
  });

  // -------------------------------------------------------------------------
  // Tarife kartlari ve projeler
  // -------------------------------------------------------------------------

  app.get('/api/rate-cards', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    return query(`SELECT * FROM rate_cards WHERE company_id = $1 ORDER BY name`, [user.companyId]);
  });

  app.post('/api/rate-cards', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO rate_cards
         (company_id, project_id, name, currency, mode, hourly_rate, daily_rate, monthly_rate,
          working_days_per_month, min_hours_per_day, overtime_after_hours, overtime_multiplier,
          idle_billable, idle_hourly_rate, transport_fee, fuel_included, fuel_price_per_liter,
          vat_rate, rounding_step_hours, rounding_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        user.companyId,
        body['projectId'] ? uuid(body['projectId'], 'projectId') : null,
        str(body, 'name', { max: 120 }),
        optionalStr(body, 'currency') ?? 'TRY',
        oneOf(body['mode'], ['hourly', 'daily', 'hourly_with_min', 'monthly'] as const, 'mode'),
        optionalNum(body, 'hourlyRate') ?? null,
        optionalNum(body, 'dailyRate') ?? null,
        optionalNum(body, 'monthlyRate') ?? null,
        optionalNum(body, 'workingDaysPerMonth') ?? 26,
        optionalNum(body, 'minHoursPerDay') ?? null,
        optionalNum(body, 'overtimeAfterHours') ?? null,
        optionalNum(body, 'overtimeMultiplier') ?? 1.5,
        bool(body, 'idleBillable', false),
        optionalNum(body, 'idleHourlyRate') ?? null,
        optionalNum(body, 'transportFee') ?? null,
        bool(body, 'fuelIncluded', true),
        optionalNum(body, 'fuelPricePerLiter') ?? null,
        optionalNum(body, 'vatRate') ?? 0.2,
        optionalNum(body, 'roundingStepHours') ?? 0.25,
        optionalStr(body, 'roundingMode') ?? 'up',
      ],
    );
    return { id: row?.id };
  });

  app.get('/api/projects', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return query(
      `SELECT id, name, customer, starts_on, ends_on, is_active FROM projects
        WHERE company_id = $1 ORDER BY is_active DESC, name`,
      [user.companyId],
    );
  });

  app.post('/api/projects', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const row = await queryOne<{ id: string }>(
      `INSERT INTO projects (company_id, name, customer, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [
        user.companyId,
        str(body, 'name', { max: 120 }),
        optionalStr(body, 'customer') ?? null,
        optionalStr(body, 'startsOn') ?? null,
        optionalStr(body, 'endsOn') ?? null,
      ],
    );
    return { id: row?.id };
  });
}

/** Basit haversine - konum maskelemede kullanilir. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_008.8;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
