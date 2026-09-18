/**
 * Gunluk toparlama isi: calisma oturumlarindan gunluk hakedisi ve yakit
 * olaylarini uretir.
 *
 * Hakedis yeniden hesaplanabilir olmalidir: gecikmis telemetri veya elle
 * duzeltme sonrasinda ayni gun tekrar hesaplandiginda dogru sonucu vermelidir.
 * Bu nedenle hesap her zaman ham verilerden yeniden turetilir; toplam uzerine
 * eklenmez. Onaylanmis (approved/invoiced) gunler korunur.
 */

import { computeDailyBilling, detectFuelEvents } from '@medentry/domain';
import { localDateKey, localDayRange, overlapSeconds } from '@medentry/shared';
import type { PositionSample, RateCard } from '@medentry/shared';
import { query, queryOne } from '../db/pool.js';
import { loadSamples } from '../pipeline/ingest.js';

interface AssetRow {
  id: string;
  company_id: string;
  project_id: string | null;
  rate_card_id: string | null;
  fuel_tank_liters: number | null;
  timezone: string;
}

interface RateCardRow {
  id: string;
  name: string;
  currency: string;
  mode: string;
  hourly_rate: number | null;
  daily_rate: number | null;
  monthly_rate: number | null;
  working_days_per_month: number | null;
  min_hours_per_day: number | null;
  overtime_after_hours: number | null;
  overtime_multiplier: number | null;
  idle_billable: boolean;
  idle_hourly_rate: number | null;
  transport_fee: number | null;
  fuel_included: boolean;
  fuel_price_per_liter: number | null;
  vat_rate: number | null;
  rounding_step_hours: number | null;
  rounding_mode: string | null;
}

function toRateCard(row: RateCardRow): RateCard {
  const card: RateCard = {
    id: row.id,
    name: row.name,
    currency: row.currency,
    mode: row.mode as RateCard['mode'],
    idleBillable: row.idle_billable,
    fuelIncluded: row.fuel_included,
  };
  if (row.hourly_rate !== null) card.hourlyRate = row.hourly_rate;
  if (row.daily_rate !== null) card.dailyRate = row.daily_rate;
  if (row.monthly_rate !== null) card.monthlyRate = row.monthly_rate;
  if (row.working_days_per_month !== null) card.workingDaysPerMonth = row.working_days_per_month;
  if (row.min_hours_per_day !== null) card.minHoursPerDay = row.min_hours_per_day;
  if (row.overtime_after_hours !== null) card.overtimeAfterHours = row.overtime_after_hours;
  if (row.overtime_multiplier !== null) card.overtimeMultiplier = row.overtime_multiplier;
  if (row.idle_hourly_rate !== null) card.idleHourlyRate = row.idle_hourly_rate;
  if (row.transport_fee !== null) card.transportFee = row.transport_fee;
  if (row.fuel_price_per_liter !== null) card.fuelPricePerLiter = row.fuel_price_per_liter;
  if (row.vat_rate !== null) card.vatRate = row.vat_rate;
  if (row.rounding_step_hours !== null) card.roundingStepHours = row.rounding_step_hours;
  if (row.rounding_mode) card.roundingMode = row.rounding_mode as RateCard['roundingMode'];
  return card;
}

/** Tek bir varlik/gun icin hakedisi yeniden hesaplar. */
export async function recomputeDailyBilling(assetId: string, dateKey: string): Promise<boolean> {
  const asset = await queryOne<AssetRow>(
    `SELECT a.id, a.company_id, a.project_id, a.rate_card_id, a.fuel_tank_liters, c.timezone
       FROM assets a JOIN companies c ON c.id = a.company_id
      WHERE a.id = $1`,
    [assetId],
  );
  if (!asset) return false;

  // Onaylanmis/faturalanmis gunler yeniden hesaplanmaz.
  const existing = await queryOne<{ status: string; manual_adjust_hours: number | null; manual_adjust_note: string | null }>(
    `SELECT status, manual_adjust_hours, manual_adjust_note
       FROM daily_billing WHERE asset_id = $1 AND work_date = $2`,
    [assetId, dateKey],
  );
  if (existing && existing.status !== 'draft') return false;

  const { start, end } = localDayRange(dateKey, asset.timezone);

  const sessions = await query<{
    started_at: Date;
    ended_at: Date | null;
    duration_sec: number;
    idle_sec: number;
    fuel_used_liters: number | null;
  }>(
    `SELECT started_at, ended_at, duration_sec, idle_sec, fuel_used_liters
       FROM work_sessions
      WHERE asset_id = $1
        AND started_at < $3
        AND COALESCE(ended_at, now()) > $2`,
    [assetId, start, end],
  );

  // Gece yarisini asan oturumlar gune oransal bolunur.
  const segments = sessions.map((s) => {
    const sessionStart = new Date(s.started_at);
    const sessionEnd = s.ended_at ? new Date(s.ended_at) : new Date();
    const totalSec = Math.max(1, (sessionEnd.getTime() - sessionStart.getTime()) / 1000);
    const inDaySec = overlapSeconds(sessionStart, sessionEnd, start, end);
    const ratio = inDaySec / totalSec;
    const durationSec = s.duration_sec > 0 ? s.duration_sec * ratio : inDaySec;
    const idleSec = s.idle_sec * ratio;
    return {
      durationSec,
      idleSec,
      workingSec: Math.max(0, durationSec - idleSec),
      fuelLiters: (s.fuel_used_liters ?? 0) * ratio,
    };
  });

  const rateCardRow = asset.rate_card_id
    ? await queryOne<RateCardRow>(`SELECT * FROM rate_cards WHERE id = $1`, [asset.rate_card_id])
    : null;

  // Tarife tanimli degilse yalnizca sure raporlanir, tutar uretilmez.
  const rateCard: RateCard = rateCardRow
    ? toRateCard(rateCardRow)
    : {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Tarife tanimsiz',
        currency: 'TRY',
        mode: 'hourly',
        hourlyRate: 0,
        idleBillable: false,
        fuelIncluded: true,
      };

  const fuelFromSessions = segments.reduce((sum, s) => sum + s.fuelLiters, 0);
  const fuelUsed = fuelFromSessions > 0 ? fuelFromSessions : await fuelUsedFromEvents(assetId, start, end);

  const billing = computeDailyBilling({
    assetId,
    dateKey,
    rateCard,
    segments: segments.map((s) => ({
      durationSec: s.durationSec,
      idleSec: s.idleSec,
      workingSec: s.workingSec,
    })),
    fuelUsedLiters: fuelUsed,
    ...(existing?.manual_adjust_hours != null ? { manualAdjustHours: existing.manual_adjust_hours } : {}),
    ...(existing?.manual_adjust_note ? { manualAdjustNote: existing.manual_adjust_note } : {}),
  });

  await query(
    `INSERT INTO daily_billing
       (company_id, asset_id, project_id, rate_card_id, work_date, currency,
        engine_hours, working_hours, idle_hours, billable_hours, normal_hours, overtime_hours,
        fuel_used_liters, amount_base, amount_overtime, amount_idle, amount_transport,
        amount_fuel, amount_net, amount_vat, amount_total, lines, status, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'draft',now())
     ON CONFLICT (asset_id, work_date) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       rate_card_id = EXCLUDED.rate_card_id,
       currency = EXCLUDED.currency,
       engine_hours = EXCLUDED.engine_hours,
       working_hours = EXCLUDED.working_hours,
       idle_hours = EXCLUDED.idle_hours,
       billable_hours = EXCLUDED.billable_hours,
       normal_hours = EXCLUDED.normal_hours,
       overtime_hours = EXCLUDED.overtime_hours,
       fuel_used_liters = EXCLUDED.fuel_used_liters,
       amount_base = EXCLUDED.amount_base,
       amount_overtime = EXCLUDED.amount_overtime,
       amount_idle = EXCLUDED.amount_idle,
       amount_transport = EXCLUDED.amount_transport,
       amount_fuel = EXCLUDED.amount_fuel,
       amount_net = EXCLUDED.amount_net,
       amount_vat = EXCLUDED.amount_vat,
       amount_total = EXCLUDED.amount_total,
       lines = EXCLUDED.lines,
       computed_at = now()
     WHERE daily_billing.status = 'draft'`,
    [
      asset.company_id,
      assetId,
      asset.project_id,
      rateCardRow?.id ?? null,
      dateKey,
      billing.currency,
      billing.engineHours,
      billing.workingHours,
      billing.idleHours,
      billing.billableHours,
      billing.normalHours,
      billing.overtimeHours,
      billing.fuelUsedLiters,
      billing.amountBase,
      billing.amountOvertime,
      billing.amountIdle,
      billing.amountTransport,
      billing.amountFuel,
      billing.amountNet,
      billing.amountVat,
      billing.amountTotal,
      JSON.stringify(billing.lines),
    ],
  );

  return true;
}

async function fuelUsedFromEvents(assetId: string, start: Date, end: Date): Promise<number> {
  const row = await queryOne<{ total: number | null }>(
    `SELECT SUM(liters) AS total FROM fuel_events
      WHERE asset_id = $1 AND ts >= $2 AND ts < $3 AND kind = 'drop' AND confidence >= 0.5`,
    [assetId, start, end],
  );
  return row?.total ?? 0;
}

/** Gun icindeki yakit dolum/dususlerini tespit edip kaydeder. */
export async function detectFuelForDay(assetId: string, dateKey: string): Promise<number> {
  const asset = await queryOne<{ company_id: string; fuel_tank_liters: number | null; timezone: string }>(
    `SELECT a.company_id, a.fuel_tank_liters, c.timezone
       FROM assets a JOIN companies c ON c.id = a.company_id
      WHERE a.id = $1`,
    [assetId],
  );
  if (!asset?.fuel_tank_liters) return 0;

  const { start, end } = localDayRange(dateKey, asset.timezone);
  const samples = (await loadSamples(assetId, start, end)) as PositionSample[];
  if (samples.length === 0) return 0;

  const events = detectFuelEvents(samples, { tankLiters: asset.fuel_tank_liters });
  let inserted = 0;

  for (const event of events) {
    // Dusuk guvenli olaylar kaydedilir ama uyari uretmez; operatoru haksiz
    // yere suclamamak icin esik uygulanir.
    const result = await query(
      `INSERT INTO fuel_events
         (company_id, asset_id, ts, kind, liters, level_before_pct, level_after_pct, lat, lon, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (asset_id, ts, kind) DO NOTHING
       RETURNING id`,
      [
        asset.company_id,
        assetId,
        event.ts,
        event.kind,
        event.liters,
        event.levelBeforePct,
        event.levelAfterPct,
        event.position?.lat ?? null,
        event.position?.lon ?? null,
        event.confidence,
      ],
    );
    if (result.length > 0) {
      inserted += 1;
      if (event.kind === 'drop' && event.confidence >= 0.75) {
        await query(
          `INSERT INTO device_events (company_id, asset_id, ts, event_type, severity, lat, lon, payload)
           VALUES ($1,$2,$3,'fuel_drop','warning',$4,$5,$6)`,
          [
            asset.company_id,
            assetId,
            event.ts,
            event.position?.lat ?? null,
            event.position?.lon ?? null,
            JSON.stringify({ liters: event.liters, confidence: event.confidence }),
          ],
        );
      }
    }
  }
  return inserted;
}

/**
 * Tum aktif varliklar icin bugunu ve dunu yeniden hesaplar.
 * Dun de hesaplanir: gece gelen gecikmis kayitlar gunu degistirebilir.
 */
export async function runRollup(): Promise<{ assets: number; days: number }> {
  const assets = await query<{ id: string; timezone: string }>(
    `SELECT a.id, c.timezone FROM assets a JOIN companies c ON c.id = a.company_id WHERE a.is_active`,
  );

  let days = 0;
  const now = new Date();
  for (const asset of assets) {
    const today = localDateKey(now, asset.timezone);
    const yesterday = localDateKey(new Date(now.getTime() - 86_400_000), asset.timezone);
    for (const dateKey of [yesterday, today]) {
      await detectFuelForDay(asset.id, dateKey);
      if (await recomputeDailyBilling(asset.id, dateKey)) days += 1;
    }
  }
  return { assets: assets.length, days };
}

/**
 * Cihaz sustugu halde acik kalmis oturumlari kapatir.
 * Aksi halde makine "hala calisiyor" gorunur ve hakedis sisirilir.
 */
export async function closeStaleSessions(maxGapSec: number): Promise<number> {
  const stale = await query<{ id: string; asset_id: string; last_ts: Date | null; started_at: Date }>(
    `SELECT ws.id, ws.asset_id, st.last_ts, ws.started_at
       FROM work_sessions ws
       LEFT JOIN asset_state st ON st.asset_id = ws.asset_id
      WHERE ws.is_open
        AND COALESCE(st.last_ts, ws.started_at) < now() - ($1 || ' seconds')::interval`,
    [String(maxGapSec)],
  );

  const { closeSession, resolveDevice } = await import('../pipeline/ingest.js');
  let closed = 0;

  for (const row of stale) {
    const device = await queryOne<{ ident: string }>(
      `SELECT ident FROM devices WHERE asset_id = $1 AND is_active ORDER BY created_at LIMIT 1`,
      [row.asset_id],
    );
    const ctx = device ? await resolveDevice(device.ident) : null;
    if (!ctx) continue;
    const endedAt = row.last_ts ? new Date(row.last_ts) : new Date(row.started_at);
    await closeSession(row.id, ctx, endedAt);
    await query(`UPDATE asset_state SET open_session_id = NULL WHERE asset_id = $1`, [row.asset_id]);
    closed += 1;
  }
  return closed;
}
