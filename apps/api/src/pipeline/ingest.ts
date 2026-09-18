/**
 * Telemetri isleme hatti.
 *
 * Cihazdan gelen normalize kayit sirasiyla:
 *   1) cihaz/varlik cozumlenir
 *   2) konum kaydedilir (tekrar eden kayitlar elenir)
 *   3) kontak gecisleri calisma oturumuna cevrilir
 *   4) geofence giris/cikislari uretilir
 *   5) alarmlar olaya cevrilir, agir olaylarda olay klibi talep edilir
 *   6) canli durum tablosu guncellenir (telefondaki tek ekranin kaynagi)
 */

import { deriveIgnition, evaluateGeofences, summarizeWindow, DEFAULT_SESSION_OPTIONS } from '@medentry/domain';
import type { SessionSample } from '@medentry/domain';
import type { AlarmCode, Geofence, NormalizedRecord } from '@medentry/shared';
import { isValidFix } from '@medentry/shared';
import { config } from '../config.js';
import { query, queryOne } from '../db/pool.js';

export interface DeviceContext {
  deviceId: string;
  companyId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  idleStrategy: 'auto' | 'speed' | 'rpm' | 'movement';
  fuelTankLiters: number | null;
  utcOffsetMinutes: number;
}

interface AssetStateRow {
  asset_id: string;
  last_ts: Date | null;
  ignition: boolean | null;
  open_session_id: string | null;
  geofence_ids: string[];
}

const CACHE_TTL_MS = 60_000;
const deviceCache = new Map<string, { value: DeviceContext | null; expires: number }>();
const geofenceCache = new Map<string, { value: Geofence[]; expires: number }>();

/** Sahada cihaz/varlik esleme degisirse onbellegi bosaltir. */
export function clearPipelineCaches(): void {
  deviceCache.clear();
  geofenceCache.clear();
}

export async function resolveDevice(ident: string): Promise<DeviceContext | null> {
  const cached = deviceCache.get(ident);
  if (cached && cached.expires > Date.now()) return cached.value;

  const row = await queryOne<{
    device_id: string;
    company_id: string;
    asset_id: string | null;
    code: string | null;
    name: string | null;
    idle_strategy: string | null;
    fuel_tank_liters: number | null;
    utc_offset_minutes: number;
  }>(
    `SELECT d.id AS device_id, d.company_id, d.asset_id, d.utc_offset_minutes,
            a.code, a.name, a.idle_strategy, a.fuel_tank_liters
       FROM devices d
       LEFT JOIN assets a ON a.id = d.asset_id
      WHERE d.ident = $1 AND d.is_active`,
    [ident],
  );

  const value: DeviceContext | null =
    row && row.asset_id
      ? {
          deviceId: row.device_id,
          companyId: row.company_id,
          assetId: row.asset_id,
          assetCode: row.code ?? '',
          assetName: row.name ?? '',
          idleStrategy: (row.idle_strategy as DeviceContext['idleStrategy']) ?? 'auto',
          fuelTankLiters: row.fuel_tank_liters,
          utcOffsetMinutes: row.utc_offset_minutes,
        }
      : null;

  deviceCache.set(ident, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

async function loadGeofences(companyId: string): Promise<Geofence[]> {
  const cached = geofenceCache.get(companyId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const rows = await query<{
    id: string;
    name: string;
    kind: string;
    purpose: string;
    center_lat: number | null;
    center_lon: number | null;
    radius_m: number | null;
    polygon: Array<{ lat: number; lon: number }> | null;
    hysteresis_m: number | null;
  }>(
    `SELECT id, name, kind, purpose, center_lat, center_lon, radius_m, polygon, hysteresis_m
       FROM geofences WHERE company_id = $1 AND is_active`,
    [companyId],
  );

  const fences: Geofence[] = rows.map((row) => {
    const fence: Geofence = {
      id: row.id,
      name: row.name,
      kind: row.kind as Geofence['kind'],
      purpose: row.purpose as Geofence['purpose'],
      active: true,
    };
    if (row.center_lat !== null && row.center_lon !== null) {
      fence.center = { lat: row.center_lat, lon: row.center_lon };
    }
    if (row.radius_m !== null) fence.radiusM = row.radius_m;
    if (row.polygon) fence.polygon = row.polygon;
    if (row.hysteresis_m !== null) fence.hysteresisM = row.hysteresis_m;
    return fence;
  });

  geofenceCache.set(companyId, { value: fences, expires: Date.now() + CACHE_TTL_MS });
  return fences;
}

export interface IngestResult {
  accepted: number;
  skipped: number;
  unknownDevices: string[];
}

export async function ingestRecords(records: readonly NormalizedRecord[]): Promise<IngestResult> {
  const result: IngestResult = { accepted: 0, skipped: 0, unknownDevices: [] };

  for (const record of records) {
    const ctx = await resolveDevice(record.deviceIdent);
    if (!ctx) {
      await noteUnknownDevice(record);
      result.skipped += 1;
      if (!result.unknownDevices.includes(record.deviceIdent)) {
        result.unknownDevices.push(record.deviceIdent);
      }
      continue;
    }
    await processRecord(record, ctx);
    result.accepted += 1;
  }

  return result;
}

async function noteUnknownDevice(record: NormalizedRecord): Promise<void> {
  await query(
    `INSERT INTO unknown_devices (ident, protocol, sample)
     VALUES ($1, $2, $3)
     ON CONFLICT (ident) DO UPDATE
        SET last_seen_at = now(),
            hit_count = unknown_devices.hit_count + 1`,
    [record.deviceIdent, record.protocol, JSON.stringify(record.raw ?? {})],
  );
}

export async function processRecord(record: NormalizedRecord, ctx: DeviceContext): Promise<void> {
  const ts = record.timestamp;
  const hasFix = record.position !== undefined && isValidFix(record.position);

  const positionId = await insertPosition(record, ctx, hasFix);
  await query(`UPDATE devices SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2) WHERE id = $1`, [
    ctx.deviceId,
    ts,
  ]);

  const state = await queryOne<AssetStateRow>(
    `SELECT asset_id, last_ts, ignition, open_session_id, geofence_ids
       FROM asset_state WHERE asset_id = $1`,
    [ctx.assetId],
  );

  // Gecmise donuk (gecikmis) kayit: konum saklanir ama canli durum ve oturum
  // durumu bozulmaz. Bu kayitlar gunluk yeniden hesapta degerlendirilir.
  const isStale = state?.last_ts != null && ts.getTime() <= new Date(state.last_ts).getTime();
  if (isStale) return;

  const sample = toSample(record, ctx);
  const ignition = deriveIgnition(sample, {
    ...DEFAULT_SESSION_OPTIONS,
    idle: { ...DEFAULT_SESSION_OPTIONS.idle, strategy: ctx.idleStrategy },
  });

  const openSessionId = await updateSessionState(ctx, state, ignition, ts, record);
  const geofenceIds = hasFix ? await updateGeofences(ctx, state, record, ts) : (state?.geofence_ids ?? []);
  await recordAlarms(record, ctx, positionId);
  await upsertAssetState(ctx, record, ts, ignition, openSessionId, geofenceIds, hasFix);
}

function toSample(record: NormalizedRecord, ctx: DeviceContext): SessionSample {
  const sample: SessionSample = {
    assetId: ctx.assetId,
    ts: record.timestamp,
    lat: record.position?.lat ?? 0,
    lon: record.position?.lon ?? 0,
    speedKph: record.speedKph ?? 0,
  };
  if (record.ignition !== undefined) sample.ignition = record.ignition;
  if (record.movement !== undefined) sample.movement = record.movement;
  if (record.engineRpm !== undefined) sample.engineRpm = record.engineRpm;
  if (record.externalV !== undefined) sample.externalV = record.externalV;
  if (record.fuelLevelPct !== undefined) sample.fuelLevelPct = record.fuelLevelPct;
  if (record.fuelLevelLiters !== undefined) sample.fuelLevelLiters = record.fuelLevelLiters;
  if (record.engineHoursSec !== undefined) sample.engineHoursSec = record.engineHoursSec;
  if (record.odometerM !== undefined) sample.odometerM = record.odometerM;
  return sample;
}

async function insertPosition(
  record: NormalizedRecord,
  ctx: DeviceContext,
  hasFix: boolean,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO positions
       (company_id, asset_id, device_id, ts, lat, lon, gps_valid, speed_kph, heading_deg,
        altitude_m, satellites, hdop, ignition, movement, odometer_m, engine_hours_sec,
        engine_rpm, fuel_level_pct, fuel_level_liters, coolant_temp_c, battery_v,
        external_v, gsm_signal, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (asset_id, ts, device_id) DO NOTHING
     RETURNING id`,
    [
      ctx.companyId,
      ctx.assetId,
      ctx.deviceId,
      record.timestamp,
      hasFix ? record.position!.lat : null,
      hasFix ? record.position!.lon : null,
      record.gpsValid,
      record.speedKph ?? 0,
      record.headingDeg ?? null,
      record.altitudeM ?? null,
      record.satellites ?? null,
      record.hdop ?? null,
      record.ignition ?? null,
      record.movement ?? null,
      record.odometerM ?? null,
      record.engineHoursSec ?? null,
      record.engineRpm ?? null,
      record.fuelLevelPct ?? null,
      record.fuelLevelLiters ?? null,
      record.coolantTempC ?? null,
      record.batteryV ?? null,
      record.externalV ?? null,
      record.gsmSignal ?? null,
      JSON.stringify(record.raw ?? {}),
    ],
  );
  return row?.id ?? null;
}

/** Kontak gecislerini oturum kayitlarina cevirir. */
async function updateSessionState(
  ctx: DeviceContext,
  state: AssetStateRow | null,
  ignition: boolean,
  ts: Date,
  record: NormalizedRecord,
): Promise<string | null> {
  const lastTs = state?.last_ts ? new Date(state.last_ts) : null;
  const gapSec = lastTs ? (ts.getTime() - lastTs.getTime()) / 1000 : 0;
  let openSessionId = state?.open_session_id ?? null;

  if (openSessionId) {
    if (!ignition) {
      await closeSession(openSessionId, ctx, ts);
      await insertEvent(ctx, ts, 'ignition_off', 'info', record);
      return null;
    }
    // Cihaz uzun sure sustu: oturumu son bilinen kayitta kapat, yenisini ac.
    if (gapSec > config.sessions.maxDataGapSec && lastTs) {
      await closeSession(openSessionId, ctx, lastTs);
      openSessionId = await openSession(ctx, ts, record);
      await insertEvent(ctx, ts, 'ignition_on', 'info', record);
    }
    return openSessionId;
  }

  if (ignition) {
    const created = await openSession(ctx, ts, record);
    await insertEvent(ctx, ts, 'ignition_on', 'info', record);
    return created;
  }
  return null;
}

async function openSession(ctx: DeviceContext, ts: Date, record: NormalizedRecord): Promise<string | null> {
  const operator = await queryOne<{ operator_id: string }>(
    `SELECT operator_id FROM operator_assignments
      WHERE asset_id = $1 AND starts_at <= $2 AND (ends_at IS NULL OR ends_at > $2)
      ORDER BY starts_at DESC LIMIT 1`,
    [ctx.assetId, ts],
  );
  const project = await queryOne<{ project_id: string | null }>(
    `SELECT project_id FROM assets WHERE id = $1`,
    [ctx.assetId],
  );

  const row = await queryOne<{ id: string }>(
    `INSERT INTO work_sessions
       (company_id, asset_id, operator_id, project_id, started_at, start_lat, start_lon,
        fuel_start_pct, is_open)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
     ON CONFLICT (asset_id) WHERE is_open DO NOTHING
     RETURNING id`,
    [
      ctx.companyId,
      ctx.assetId,
      operator?.operator_id ?? null,
      project?.project_id ?? null,
      ts,
      record.position?.lat ?? null,
      record.position?.lon ?? null,
      record.fuelLevelPct ?? null,
    ],
  );
  return row?.id ?? null;
}

/** Oturumu kapatir ve sure/rolanti/mesafe ozetini hesaplar. */
export async function closeSession(sessionId: string, ctx: DeviceContext, endedAt: Date): Promise<void> {
  const session = await queryOne<{ started_at: Date }>(
    `SELECT started_at FROM work_sessions WHERE id = $1 AND is_open`,
    [sessionId],
  );
  if (!session) return;

  const startedAt = new Date(session.started_at);
  const samples = await loadSamples(ctx.assetId, startedAt, endedAt);
  const summary = summarizeWindow(samples, startedAt, endedAt, {
    strategy: ctx.idleStrategy,
    minSec: config.sessions.idleMinSec,
  });

  const last = samples[samples.length - 1];
  const fuelStart = samples.find((s) => s.fuelLevelPct !== undefined)?.fuelLevelPct ?? null;
  const fuelEnd = [...samples].reverse().find((s) => s.fuelLevelPct !== undefined)?.fuelLevelPct ?? null;
  const fuelUsed =
    fuelStart !== null && fuelEnd !== null && ctx.fuelTankLiters && fuelStart >= fuelEnd
      ? ((fuelStart - fuelEnd) * ctx.fuelTankLiters) / 100
      : null;

  await query(
    `UPDATE work_sessions
        SET ended_at = $2, duration_sec = $3, idle_sec = $4, working_sec = $5,
            distance_m = $6, end_lat = $7, end_lon = $8,
            fuel_start_pct = COALESCE(fuel_start_pct, $9), fuel_end_pct = $10,
            fuel_used_liters = $11, is_open = false, updated_at = now()
      WHERE id = $1`,
    [
      sessionId,
      endedAt,
      Math.round(summary.durationSec),
      Math.round(summary.idleSec),
      Math.round(summary.workingSec),
      summary.distanceM,
      last && isValidFix(last) ? last.lat : null,
      last && isValidFix(last) ? last.lon : null,
      fuelStart,
      fuelEnd,
      fuelUsed !== null ? Math.round(fuelUsed * 100) / 100 : null,
    ],
  );

  // Uzun rolanti, yakit maliyeti ve motor omru acisindan raporlanir.
  for (const period of summary.idlePeriods) {
    if (period.durationSec < config.sessions.idleMinSec) continue;
    await query(
      `INSERT INTO device_events (company_id, asset_id, ts, event_type, severity, lat, lon, payload)
       VALUES ($1,$2,$3,'idle','info',$4,$5,$6)`,
      [
        ctx.companyId,
        ctx.assetId,
        period.startedAt,
        period.position?.lat ?? null,
        period.position?.lon ?? null,
        JSON.stringify({ durationSec: Math.round(period.durationSec) }),
      ],
    );
  }
}

export async function loadSamples(assetId: string, from: Date, to: Date): Promise<SessionSample[]> {
  const rows = await query<{
    ts: Date;
    lat: number | null;
    lon: number | null;
    speed_kph: number;
    ignition: boolean | null;
    movement: boolean | null;
    engine_rpm: number | null;
    external_v: number | null;
    fuel_level_pct: number | null;
    fuel_level_liters: number | null;
    engine_hours_sec: number | null;
    odometer_m: number | null;
  }>(
    `SELECT ts, lat, lon, speed_kph, ignition, movement, engine_rpm, external_v,
            fuel_level_pct, fuel_level_liters, engine_hours_sec, odometer_m
       FROM positions
      WHERE asset_id = $1 AND ts >= $2 AND ts <= $3
      ORDER BY ts ASC`,
    [assetId, from, to],
  );

  return rows.map((row) => {
    const sample: SessionSample = {
      assetId,
      ts: new Date(row.ts),
      lat: row.lat ?? 0,
      lon: row.lon ?? 0,
      speedKph: row.speed_kph,
    };
    if (row.ignition !== null) sample.ignition = row.ignition;
    if (row.movement !== null) sample.movement = row.movement;
    if (row.engine_rpm !== null) sample.engineRpm = row.engine_rpm;
    if (row.external_v !== null) sample.externalV = row.external_v;
    if (row.fuel_level_pct !== null) sample.fuelLevelPct = row.fuel_level_pct;
    if (row.fuel_level_liters !== null) sample.fuelLevelLiters = row.fuel_level_liters;
    if (row.engine_hours_sec !== null) sample.engineHoursSec = row.engine_hours_sec;
    if (row.odometer_m !== null) sample.odometerM = row.odometer_m;
    return sample;
  });
}

async function updateGeofences(
  ctx: DeviceContext,
  state: AssetStateRow | null,
  record: NormalizedRecord,
  ts: Date,
): Promise<string[]> {
  const fences = await loadGeofences(ctx.companyId);
  if (fences.length === 0) return [];

  const previous = new Set(state?.geofence_ids ?? []);
  const { transitions, state: nextState } = evaluateGeofences(record.position!, ts, fences, previous);

  for (const transition of transitions) {
    await query(
      `INSERT INTO geofence_events (company_id, asset_id, geofence_id, ts, kind, lat, lon)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ctx.companyId,
        ctx.assetId,
        transition.geofenceId,
        transition.ts,
        transition.kind,
        transition.position.lat,
        transition.position.lon,
      ],
    );

    const fence = fences.find((f) => f.id === transition.geofenceId);
    // Yasakli bolgeye giris operasyon uyarisi uretir.
    if (fence?.purpose === 'restricted' && transition.kind === 'enter') {
      await insertEvent(ctx, transition.ts, 'geofence_enter', 'warning', record, {
        geofenceId: fence.id,
        geofenceName: fence.name,
        purpose: fence.purpose,
      });
    }
  }

  return [...nextState];
}

const ALARM_SEVERITY: Partial<Record<AlarmCode, 'info' | 'warning' | 'critical'>> = {
  sos: 'critical',
  crash: 'critical',
  power_cut: 'warning',
  tow: 'critical',
  jamming: 'warning',
  overspeed: 'warning',
  harsh_braking: 'warning',
  harsh_acceleration: 'warning',
  harsh_cornering: 'warning',
  low_battery: 'info',
  fuel_drop: 'warning',
};

/** Olay aninda kamera klibi cekilecek alarmlar (KVKK: olay bazli kayit). */
const CLIP_ALARMS: ReadonlySet<AlarmCode> = new Set<AlarmCode>([
  'crash',
  'sos',
  'harsh_braking',
  'harsh_acceleration',
  'harsh_cornering',
  'tow',
]);

async function recordAlarms(
  record: NormalizedRecord,
  ctx: DeviceContext,
  _positionId: number | null,
): Promise<void> {
  for (const alarm of record.alarms ?? []) {
    if (alarm === 'unknown') continue;
    const severity = ALARM_SEVERITY[alarm] ?? 'info';
    const eventId = await insertEvent(ctx, record.timestamp, alarm, severity, record);
    if (eventId && CLIP_ALARMS.has(alarm)) {
      await requestEventClip(ctx, eventId, record.timestamp);
    }
  }
}

async function insertEvent(
  ctx: DeviceContext,
  ts: Date,
  eventType: string,
  severity: 'info' | 'warning' | 'critical',
  record: NormalizedRecord,
  payload: Record<string, unknown> = {},
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO device_events
       (company_id, asset_id, device_id, ts, event_type, severity, lat, lon, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      ctx.companyId,
      ctx.assetId,
      ctx.deviceId,
      ts,
      eventType,
      severity,
      record.position?.lat ?? null,
      record.position?.lon ?? null,
      JSON.stringify({ speedKph: record.speedKph, ...payload }),
    ],
  );
  return row?.id ?? null;
}

/**
 * Olay klibi talebi: olaydan 30 sn once / 30 sn sonra.
 * Bu, kabin kamerasi goruntusunun tek mesru kaynagidir; surekli kayit veya
 * canli izleme yoluyla kabin goruntusu alinmaz.
 */
export async function requestEventClip(ctx: DeviceContext, eventId: number, ts: Date): Promise<void> {
  const cameras = await query<{ id: string }>(
    `SELECT c.id
       FROM device_cameras c
       JOIN devices d ON d.id = c.device_id
      WHERE d.asset_id = $1 AND c.is_active`,
    [ctx.assetId],
  );
  if (cameras.length === 0) return;

  const windowStart = new Date(ts.getTime() - 30_000);
  const windowEnd = new Date(ts.getTime() + 30_000);

  for (const camera of cameras) {
    await query(
      `INSERT INTO media_requests
         (company_id, asset_id, camera_id, event_id, window_start, window_end, purpose, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,'is_guvenligi',$7,'pending')`,
      [
        ctx.companyId,
        ctx.assetId,
        camera.id,
        eventId,
        windowStart,
        windowEnd,
        'Otomatik olay klibi (sistem tarafindan olusturuldu)',
      ],
    );
  }
  await query(`UPDATE device_events SET clip_requested = true WHERE id = $1`, [eventId]);
}

async function upsertAssetState(
  ctx: DeviceContext,
  record: NormalizedRecord,
  ts: Date,
  ignition: boolean,
  openSessionId: string | null,
  geofenceIds: string[],
  hasFix: boolean,
): Promise<void> {
  await query(
    `INSERT INTO asset_state
       (asset_id, company_id, last_ts, lat, lon, speed_kph, heading_deg, ignition, movement,
        fuel_level_pct, engine_hours_sec, odometer_m, battery_v, external_v, gsm_signal,
        open_session_id, geofence_ids, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
     ON CONFLICT (asset_id) DO UPDATE SET
       last_ts = EXCLUDED.last_ts,
       lat = COALESCE(EXCLUDED.lat, asset_state.lat),
       lon = COALESCE(EXCLUDED.lon, asset_state.lon),
       speed_kph = EXCLUDED.speed_kph,
       heading_deg = COALESCE(EXCLUDED.heading_deg, asset_state.heading_deg),
       ignition = EXCLUDED.ignition,
       movement = COALESCE(EXCLUDED.movement, asset_state.movement),
       fuel_level_pct = COALESCE(EXCLUDED.fuel_level_pct, asset_state.fuel_level_pct),
       engine_hours_sec = COALESCE(EXCLUDED.engine_hours_sec, asset_state.engine_hours_sec),
       odometer_m = COALESCE(EXCLUDED.odometer_m, asset_state.odometer_m),
       battery_v = COALESCE(EXCLUDED.battery_v, asset_state.battery_v),
       external_v = COALESCE(EXCLUDED.external_v, asset_state.external_v),
       gsm_signal = COALESCE(EXCLUDED.gsm_signal, asset_state.gsm_signal),
       open_session_id = EXCLUDED.open_session_id,
       geofence_ids = EXCLUDED.geofence_ids,
       updated_at = now()`,
    [
      ctx.assetId,
      ctx.companyId,
      ts,
      hasFix ? record.position!.lat : null,
      hasFix ? record.position!.lon : null,
      record.speedKph ?? 0,
      record.headingDeg ?? null,
      ignition,
      record.movement ?? null,
      record.fuelLevelPct ?? null,
      record.engineHoursSec ?? null,
      record.odometerM ?? null,
      record.batteryV ?? null,
      record.externalV ?? null,
      record.gsmSignal ?? null,
      openSessionId,
      geofenceIds,
    ],
  );
}
