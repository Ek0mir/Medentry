/**
 * Tek ekran (dashboard) uclari.
 *
 * Telefonda tek bakista su sorulari cevaplar:
 *   Makine nerede -> kacta calisti -> kac saat calisti -> kim kullaniyor ->
 *   goruntu -> yakit/calisma verisi -> gunluk hakedis
 *
 * KVKK: Bu uclar kisisel veri (operator kimligi, konum) icerdigi icin
 * erisim politikasindan gecer. Ekran surekli yenilendiginden denetim kaydi
 * kullanici+islem bazinda birlestirilerek yazilir (auditThrottleMs).
 */

import type { FastifyInstance } from 'fastify';
import { evaluateAccess } from '@medentry/domain';
import { ASSET_TYPE_LABELS, CAMERA_POSITION_LABELS, localDateKey, localDayRange } from '@medentry/shared';
import type { AssetType, CameraPosition, PrivacyWindow } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requestMeta } from '../auth/context.js';
import { query, queryOne } from '../db/pool.js';
import { guardAccess, loadPrivacyWindows } from '../kvkk/guard.js';
import { dateKey as parseDateKey, limit as parseLimit, uuid } from './validate.js';

/** Bu sureden uzun sure haber alinamayan cihaz cevrimdisi sayilir. */
const OFFLINE_AFTER_SEC = 1800;

interface DashboardRow {
  id: string;
  code: string;
  name: string;
  category: string;
  asset_type: string;
  plate: string | null;
  fuel_tank_liters: number | null;
  project_name: string | null;
  last_ts: Date | null;
  lat: number | null;
  lon: number | null;
  speed_kph: number | null;
  heading_deg: number | null;
  ignition: boolean | null;
  movement: boolean | null;
  fuel_level_pct: number | null;
  engine_hours_sec: number | null;
  odometer_m: number | null;
  gsm_signal: number | null;
  open_session_id: string | null;
  geofence_ids: string[] | null;
  operator_id: string | null;
  operator_name: string | null;
  operator_phone: string | null;
  operator_source: string | null;
  first_start: Date | null;
  last_stop: Date | null;
  today_duration_sec: number | null;
  today_idle_sec: number | null;
  session_count: number | null;
  billable_hours: number | null;
  amount_total: number | null;
  currency: string | null;
  billing_status: string | null;
  fuel_used_liters: number | null;
}

const DASHBOARD_SQL = `
  SELECT a.id, a.code, a.name, a.category, a.asset_type, a.plate, a.fuel_tank_liters,
         pr.name AS project_name,
         st.last_ts, st.lat, st.lon, st.speed_kph, st.heading_deg, st.ignition, st.movement,
         st.fuel_level_pct, st.engine_hours_sec, st.odometer_m, st.gsm_signal,
         st.open_session_id, st.geofence_ids,
         op.operator_id, op.source AS operator_source,
         u.full_name AS operator_name, u.phone AS operator_phone,
         today.first_start, today.last_stop, today.duration_sec AS today_duration_sec,
         today.idle_sec AS today_idle_sec, today.session_count,
         db.billable_hours, db.amount_total, db.currency, db.status AS billing_status,
         db.fuel_used_liters
    FROM assets a
    LEFT JOIN asset_state st ON st.asset_id = a.id
    LEFT JOIN projects pr ON pr.id = a.project_id
    LEFT JOIN LATERAL (
      SELECT oa.operator_id, oa.source
        FROM operator_assignments oa
       WHERE oa.asset_id = a.id
         AND oa.starts_at <= now()
         AND (oa.ends_at IS NULL OR oa.ends_at > now())
       ORDER BY oa.starts_at DESC
       LIMIT 1
    ) op ON true
    LEFT JOIN users u ON u.id = op.operator_id
    LEFT JOIN daily_billing db ON db.asset_id = a.id AND db.work_date = $2
    LEFT JOIN LATERAL (
      SELECT MIN(ws.started_at) AS first_start,
             MAX(ws.ended_at) AS last_stop,
             COUNT(*) AS session_count,
             -- Gune dusen kisim: gece yarisini asan oturumlar kirpilir.
             SUM(EXTRACT(EPOCH FROM (
               LEAST(COALESCE(ws.ended_at, now()), $4) - GREATEST(ws.started_at, $3)
             ))) AS duration_sec,
             -- Rolanti, oturumun gune dusen orani kadar sayilir.
             SUM(ws.idle_sec * (
               EXTRACT(EPOCH FROM (LEAST(COALESCE(ws.ended_at, now()), $4) - GREATEST(ws.started_at, $3)))
               / GREATEST(EXTRACT(EPOCH FROM (COALESCE(ws.ended_at, now()) - ws.started_at)), 1)
             )) AS idle_sec
        FROM work_sessions ws
       WHERE ws.asset_id = a.id
         AND ws.started_at < $4
         AND COALESCE(ws.ended_at, now()) > $3
    ) today ON true
   WHERE a.company_id = $1 AND a.is_active
   ORDER BY a.code
`;

interface CameraRow {
  id: string;
  asset_id: string;
  channel_no: number;
  position: string;
  label: string | null;
  privacy_class: string;
  records_audio: boolean;
  event_only: boolean;
  sd_recording: boolean;
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;

    await guardAccess({
      user,
      purpose: typeof q['purpose'] === 'string' ? q['purpose'] : 'operasyon_yonetimi',
      dataType: 'position',
      action: 'dashboard_list',
      ip: meta.ip,
      userAgent: meta.userAgent,
      // Ekran 15 sn'de bir yenilenir; ayni kullanicinin izin kayitlari
      // 15 dakikada bir yazilir.
      auditThrottleMs: 15 * 60_000,
    });

    const timezone = await companyTimezone(user.companyId);
    const dateKey = q['date'] ? parseDateKey(q['date'], 'date') : localDateKey(new Date(), timezone);
    const { start, end } = localDayRange(dateKey, timezone);

    const rows = await query<DashboardRow>(DASHBOARD_SQL, [user.companyId, dateKey, start, end]);
    const assetIds = rows.map((r) => r.id);

    const [cameras, alerts, geofenceNames, privacyWindows] = await Promise.all([
      loadCameras(user.companyId),
      loadRecentAlerts(user.companyId),
      loadGeofenceNames(user.companyId),
      loadPrivacyWindows(user.companyId),
    ]);

    const assets = rows.map((row) =>
      toDashboardAsset(row, {
        cameras: cameras.filter((c) => c.asset_id === row.id),
        alerts: alerts.filter((a) => a.asset_id === row.id),
        geofenceNames,
        privacyWindows,
        role: user.role,
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      date: dateKey,
      timezone,
      totals: {
        assets: assets.length,
        working: assets.filter((a) => a.status === 'working').length,
        idle: assets.filter((a) => a.status === 'idle').length,
        stopped: assets.filter((a) => a.status === 'stopped').length,
        offline: assets.filter((a) => a.status === 'offline').length,
        engineHours: round2(assets.reduce((sum, a) => sum + a.today.engineHours, 0)),
        billableHours: round2(assets.reduce((sum, a) => sum + (a.billing?.billableHours ?? 0), 0)),
        amountTotal: round2(assets.reduce((sum, a) => sum + (a.billing?.amountTotal ?? 0), 0)),
        currency: assets.find((a) => a.billing?.currency)?.billing?.currency ?? 'TRY',
      },
      assets,
      assetIds,
    };
  });

  app.get('/api/dashboard/:assetId', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const params = request.params as Record<string, unknown>;
    const q = request.query as Record<string, unknown>;
    const assetId = uuid(params['assetId'], 'assetId');

    await guardAccess({
      user,
      purpose: typeof q['purpose'] === 'string' ? q['purpose'] : 'operasyon_yonetimi',
      dataType: 'position_history',
      action: 'dashboard_detail',
      assetId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      auditThrottleMs: 5 * 60_000,
    });

    const timezone = await companyTimezone(user.companyId);
    const dateKey = q['date'] ? parseDateKey(q['date'], 'date') : localDateKey(new Date(), timezone);
    const { start, end } = localDayRange(dateKey, timezone);

    const rows = await query<DashboardRow>(
      `${DASHBOARD_SQL.replace('WHERE a.company_id = $1 AND a.is_active', 'WHERE a.company_id = $1 AND a.id = $5')}`,
      [user.companyId, dateKey, start, end, assetId],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, 'Varlik bulunamadi');

    const [cameras, alerts, geofenceNames, privacyWindows] = await Promise.all([
      loadCameras(user.companyId, assetId),
      loadRecentAlerts(user.companyId, assetId),
      loadGeofenceNames(user.companyId),
      loadPrivacyWindows(user.companyId, assetId),
    ]);

    const asset = toDashboardAsset(row, {
      cameras,
      alerts,
      geofenceNames,
      privacyWindows,
      role: user.role,
    });

    const sessions = await query<{
      id: string;
      started_at: Date;
      ended_at: Date | null;
      duration_sec: number;
      idle_sec: number;
      working_sec: number;
      distance_m: number;
      is_open: boolean;
      operator_name: string | null;
    }>(
      `SELECT ws.id, ws.started_at, ws.ended_at, ws.duration_sec, ws.idle_sec, ws.working_sec,
              ws.distance_m, ws.is_open, u.full_name AS operator_name
         FROM work_sessions ws
         LEFT JOIN users u ON u.id = ws.operator_id
        WHERE ws.asset_id = $1 AND ws.started_at < $3 AND COALESCE(ws.ended_at, now()) > $2
        ORDER BY ws.started_at`,
      [assetId, start, end],
    );

    const billing = await queryOne<{
      billable_hours: number;
      normal_hours: number;
      overtime_hours: number;
      idle_hours: number;
      engine_hours: number;
      amount_net: number;
      amount_vat: number;
      amount_total: number;
      currency: string;
      status: string;
      lines: unknown;
    }>(
      `SELECT billable_hours, normal_hours, overtime_hours, idle_hours, engine_hours,
              amount_net, amount_vat, amount_total, currency, status, lines
         FROM daily_billing WHERE asset_id = $1 AND work_date = $2`,
      [assetId, dateKey],
    );

    const track = await loadTrack(assetId, start, end, parseLimit(q['points'], 500, 5000));

    return {
      date: dateKey,
      timezone,
      asset,
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationSec: s.duration_sec,
        idleSec: s.idle_sec,
        workingSec: s.working_sec,
        distanceKm: Math.round((s.distance_m / 1000) * 10) / 10,
        open: s.is_open,
        operator: s.operator_name,
      })),
      billing: billing
        ? {
            billableHours: billing.billable_hours,
            normalHours: billing.normal_hours,
            overtimeHours: billing.overtime_hours,
            idleHours: billing.idle_hours,
            engineHours: billing.engine_hours,
            amountNet: billing.amount_net,
            amountVat: billing.amount_vat,
            amountTotal: billing.amount_total,
            currency: billing.currency,
            status: billing.status,
            lines: billing.lines,
          }
        : null,
      track,
    };
  });
}

interface DecorateInput {
  cameras: CameraRow[];
  alerts: Array<{ asset_id: string; event_type: string; severity: string; ts: Date; id: number }>;
  geofenceNames: Map<string, { name: string; purpose: string }>;
  privacyWindows: PrivacyWindow[];
  role: ReturnType<typeof currentUser>['role'];
}

function toDashboardAsset(row: DashboardRow, input: DecorateInput) {
  const now = Date.now();
  const lastTs = row.last_ts ? new Date(row.last_ts) : null;
  const ageSec = lastTs ? Math.round((now - lastTs.getTime()) / 1000) : null;
  const offline = ageSec === null || ageSec > OFFLINE_AFTER_SEC;

  const status: 'working' | 'idle' | 'stopped' | 'offline' = offline
    ? 'offline'
    : row.ignition
      ? (row.speed_kph ?? 0) > 2 || row.movement
        ? 'working'
        : 'idle'
      : 'stopped';

  const durationSec = Number(row.today_duration_sec ?? 0);
  const idleSec = Number(row.today_idle_sec ?? 0);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    type: row.asset_type,
    typeLabel: ASSET_TYPE_LABELS[row.asset_type as AssetType] ?? row.asset_type,
    plate: row.plate,
    project: row.project_name,
    status,
    /** Makine nerede */
    position:
      row.lat !== null && row.lon !== null
        ? {
            lat: row.lat,
            lon: row.lon,
            speedKph: row.speed_kph ?? 0,
            headingDeg: row.heading_deg,
            ts: lastTs,
            ageSec,
          }
        : null,
    geofences: (row.geofence_ids ?? [])
      .map((id) => {
        const fence = input.geofenceNames.get(id);
        return fence ? { id, name: fence.name, purpose: fence.purpose } : null;
      })
      .filter((x): x is { id: string; name: string; purpose: string } => x !== null),
    /** Kacta calisti / kac saat calisti */
    today: {
      firstStartAt: row.first_start,
      lastStopAt: row.last_stop,
      sessionCount: Number(row.session_count ?? 0),
      engineHours: round2(durationSec / 3600),
      idleHours: round2(idleSec / 3600),
      workingHours: round2(Math.max(0, durationSec - idleSec) / 3600),
      running: row.open_session_id !== null,
    },
    /** Kim kullaniyor */
    operator: row.operator_id
      ? {
          id: row.operator_id,
          name: row.operator_name,
          phone: row.operator_phone,
          source: row.operator_source,
        }
      : null,
    /** Yakit / calisma verisi */
    fuel: {
      levelPct: row.fuel_level_pct,
      tankLiters: row.fuel_tank_liters,
      usedLitersToday: row.fuel_used_liters ?? 0,
      engineHoursTotal: row.engine_hours_sec ? round2(row.engine_hours_sec / 3600) : null,
      odometerKm: row.odometer_m ? Math.round(row.odometer_m / 1000) : null,
    },
    /** Goruntu */
    cameras: input.cameras.map((camera) => {
      // Politika motoru arayuze "izlenebilir mi, izlenemezse neden" bilgisini
      // verir; boylece kullanici reddedilecek bir istekle ugrasmaz.
      const decision = evaluateAccess({
        role: input.role,
        purpose: 'is_guvenligi',
        dataType: 'camera_live',
        ts: new Date(),
        assetId: row.id,
        cameraPosition: camera.position as CameraPosition,
        // Arayuz on-kontrolu: gerekce metni izleme aninda girilecek.
        reason: 'on kontrol icin ornek gerekce metni',
        operatorAcknowledged: true,
        privacyWindows: input.privacyWindows,
      });
      return {
        id: camera.id,
        channelNo: camera.channel_no,
        position: camera.position,
        positionLabel: CAMERA_POSITION_LABELS[camera.position as CameraPosition] ?? camera.position,
        label: camera.label,
        privacyClass: camera.privacy_class,
        recordsAudio: camera.records_audio,
        eventOnly: camera.event_only,
        sdRecording: camera.sd_recording,
        liveAllowed: decision.allowed,
        liveBlockedReason: decision.allowed ? null : decision.message,
      };
    }),
    /** Gunluk hakedis */
    billing: row.billable_hours !== null
      ? {
          billableHours: row.billable_hours,
          amountTotal: row.amount_total ?? 0,
          currency: row.currency ?? 'TRY',
          status: row.billing_status ?? 'draft',
        }
      : null,
    alerts: input.alerts.map((a) => ({
      id: a.id,
      type: a.event_type,
      severity: a.severity,
      ts: a.ts,
    })),
  };
}

async function companyTimezone(companyId: string): Promise<string> {
  const row = await queryOne<{ timezone: string }>(`SELECT timezone FROM companies WHERE id = $1`, [
    companyId,
  ]);
  return row?.timezone ?? 'Europe/Istanbul';
}

async function loadCameras(companyId: string, assetId?: string): Promise<CameraRow[]> {
  return query<CameraRow>(
    `SELECT c.id, d.asset_id, c.channel_no, c.position, c.label, c.privacy_class,
            c.records_audio, c.event_only, c.sd_recording
       FROM device_cameras c
       JOIN devices d ON d.id = c.device_id
      WHERE c.company_id = $1 AND c.is_active AND d.asset_id IS NOT NULL
        AND ($2::uuid IS NULL OR d.asset_id = $2)
      ORDER BY d.asset_id, c.channel_no`,
    [companyId, assetId ?? null],
  );
}

async function loadRecentAlerts(companyId: string, assetId?: string) {
  return query<{ id: number; asset_id: string; event_type: string; severity: string; ts: Date }>(
    `SELECT id, asset_id, event_type, severity, ts
       FROM device_events
      WHERE company_id = $1
        AND severity IN ('warning','critical')
        AND ts > now() - interval '24 hours'
        AND acknowledged_at IS NULL
        AND ($2::uuid IS NULL OR asset_id = $2)
      ORDER BY ts DESC
      LIMIT 200`,
    [companyId, assetId ?? null],
  );
}

async function loadGeofenceNames(companyId: string): Promise<Map<string, { name: string; purpose: string }>> {
  const rows = await query<{ id: string; name: string; purpose: string }>(
    `SELECT id, name, purpose FROM geofences WHERE company_id = $1 AND is_active`,
    [companyId],
  );
  return new Map(rows.map((r) => [r.id, { name: r.name, purpose: r.purpose }]));
}

/** Gun icindeki iz (harita cizgisi). Cok yogun veride seyreltilir. */
async function loadTrack(assetId: string, start: Date, end: Date, maxPoints: number) {
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM positions WHERE asset_id = $1 AND ts >= $2 AND ts < $3 AND lat IS NOT NULL`,
    [assetId, start, end],
  );
  const total = Number(countRow?.total ?? 0);
  const step = total > maxPoints ? Math.ceil(total / maxPoints) : 1;

  const rows = await query<{ ts: Date; lat: number; lon: number; speed_kph: number; ignition: boolean | null }>(
    `SELECT ts, lat, lon, speed_kph, ignition FROM (
        SELECT ts, lat, lon, speed_kph, ignition,
               ROW_NUMBER() OVER (ORDER BY ts) AS rn
          FROM positions
         WHERE asset_id = $1 AND ts >= $2 AND ts < $3 AND lat IS NOT NULL
      ) t
      WHERE rn % $4 = 0 OR rn = 1
      ORDER BY ts`,
    [assetId, start, end, step],
  );

  return rows.map((r) => ({
    ts: r.ts,
    lat: r.lat,
    lon: r.lon,
    speedKph: r.speed_kph,
    ignition: r.ignition,
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
