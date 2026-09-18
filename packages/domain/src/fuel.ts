/**
 * Yakit analizi: dolum ve ani dusus (hirsizlik suphesi) tespiti.
 *
 * Yakit sensorleri gurultuludur: arac hareket halindeyken depodaki calkanti,
 * egimli arazi ve sensor sicramalari yanlis alarm uretir. Bu nedenle once
 * medyan filtresi uygulanir, sonra olaylar kararlilik (stabilizasyon)
 * kontrolu ile dogrulanir ve her olaya guven skoru verilir.
 */

import { isValidFix, type LatLon } from '@medentry/shared';
import type { FuelEvent, PositionSample } from '@medentry/shared';

export interface FuelOptions {
  /** Medyan filtre pencere boyutu (tek sayi olmali). */
  medianWindow: number;
  /** Dolum sayilmasi icin asgari artis (yuzde puan). */
  minFillPct: number;
  /** Supheli dusus sayilmasi icin asgari azalma (yuzde puan). */
  minDropPct: number;
  /** Bir olayin tamamlanma suresi ust siniri (saniye). */
  maxEventDurationSec: number;
  /** Olay oncesi/sonrasi seviyenin kararli kalmasi beklenen sure (saniye). */
  stabilizationSec: number;
  /** Depo hacmi - yuzdeyi litreye cevirmek icin. */
  tankLiters?: number;
}

export const DEFAULT_FUEL_OPTIONS: FuelOptions = {
  medianWindow: 5,
  minFillPct: 5,
  minDropPct: 5,
  maxEventDurationSec: 1800,
  stabilizationSec: 120,
};

interface FuelPoint {
  ts: Date;
  level: number;
  raw: number;
  moving: boolean;
  position?: LatLon;
}

/** Medyan filtresi uygular; sicramalari temizler, rampalari korur. */
export function medianFilter(values: readonly number[], window: number): number[] {
  const w = Math.max(1, window % 2 === 0 ? window + 1 : window);
  if (w === 1 || values.length === 0) return [...values];
  const half = Math.floor(w / 2);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    const slice = values.slice(from, to).sort((a, b) => a - b);
    const mid = Math.floor(slice.length / 2);
    out.push(slice.length % 2 === 1 ? slice[mid]! : (slice[mid - 1]! + slice[mid]!) / 2);
  }
  return out;
}

/**
 * Konum kayitlarindan yakit dolum/dususlerini cikarir.
 * `samples` zaman sirali olmalidir.
 */
export function detectFuelEvents(
  samples: readonly PositionSample[],
  options: Partial<FuelOptions> = {},
): FuelEvent[] {
  const opts = { ...DEFAULT_FUEL_OPTIONS, ...options };
  const points = toFuelPoints(samples, opts);
  if (points.length < 3) return [];

  const events: FuelEvent[] = [];
  let i = 0;

  while (i < points.length - 1) {
    const start = points[i]!;
    let j = i + 1;
    let direction = 0;
    // Yonun son kez degistigi nokta: olayin gercek bitisi burasidir.
    // Plato uzerinden bitisi ilerletmek, olayi normal tuketime benzetir.
    let lastChange = i;

    while (j < points.length) {
      const prev = points[j - 1]!;
      const cur = points[j]!;
      const delta = cur.level - prev.level;
      const stepDir = delta > 0.2 ? 1 : delta < -0.2 ? -1 : 0;

      if (stepDir === 0) {
        // Kisa plato (or. iki dolum arasi duraklama) kosuyu bolmez.
        if (direction === 0) break;
        const sincePeak = (cur.ts.getTime() - points[lastChange]!.ts.getTime()) / 1000;
        if (sincePeak > opts.stabilizationSec) break;
        j += 1;
        continue;
      }

      if (direction === 0) direction = stepDir;
      else if (stepDir !== direction) break;

      const sinceStart = (cur.ts.getTime() - start.ts.getTime()) / 1000;
      if (sinceStart > opts.maxEventDurationSec) break;

      lastChange = j;
      j += 1;
    }

    if (direction === 0 || lastChange === i) {
      i += 1;
      continue;
    }

    const end = points[lastChange]!;
    const change = end.level - start.level;
    const durationSec = (end.ts.getTime() - start.ts.getTime()) / 1000;

    if (direction === 1 && change >= opts.minFillPct) {
      events.push(makeEvent('fill', start, end, change, durationSec, points, i, lastChange, opts));
      i = lastChange;
      continue;
    }
    if (direction === -1 && -change >= opts.minDropPct && durationSec <= opts.maxEventDurationSec) {
      events.push(makeEvent('drop', start, end, change, durationSec, points, i, lastChange, opts));
      i = lastChange;
      continue;
    }
    i += 1;
  }

  return events;
}

function toFuelPoints(samples: readonly PositionSample[], opts: FuelOptions): FuelPoint[] {
  const withFuel = samples
    .filter((s) => typeof s.fuelLevelPct === 'number' && s.fuelLevelPct! >= 0 && s.fuelLevelPct! <= 100)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
  if (withFuel.length === 0) return [];

  const smoothed = medianFilter(
    withFuel.map((s) => s.fuelLevelPct!),
    opts.medianWindow,
  );

  return withFuel.map((s, idx) => {
    const point: FuelPoint = {
      ts: s.ts,
      level: smoothed[idx]!,
      raw: s.fuelLevelPct!,
      moving: s.speedKph > 3 || s.movement === true,
    };
    if (isValidFix(s)) point.position = { lat: s.lat, lon: s.lon };
    return point;
  });
}

function makeEvent(
  kind: 'fill' | 'drop',
  start: FuelPoint,
  end: FuelPoint,
  changePct: number,
  durationSec: number,
  points: readonly FuelPoint[],
  startIdx: number,
  endIdx: number,
  opts: FuelOptions,
): FuelEvent {
  const magnitude = Math.abs(changePct);
  const liters = opts.tankLiters ? (magnitude * opts.tankLiters) / 100 : magnitude;

  const event: FuelEvent = {
    assetId: '',
    ts: kind === 'fill' ? end.ts : start.ts,
    kind,
    liters: Math.round(liters * 10) / 10,
    levelBeforePct: Math.round(start.level * 10) / 10,
    levelAfterPct: Math.round(end.level * 10) / 10,
    confidence: scoreConfidence(kind, magnitude, durationSec, points, startIdx, endIdx, opts),
  };
  const pos = kind === 'fill' ? (end.position ?? start.position) : (start.position ?? end.position);
  if (pos) event.position = pos;
  return event;
}

/**
 * Guven skoru:
 *  - buyuk degisim  -> yuksek
 *  - arac dururken  -> yuksek (calkanti yok)
 *  - oncesi/sonrasi kararli -> yuksek
 *  - cok uzun sureye yayilmis -> dusuk (normal tuketim olabilir)
 */
function scoreConfidence(
  kind: 'fill' | 'drop',
  magnitudePct: number,
  durationSec: number,
  points: readonly FuelPoint[],
  startIdx: number,
  endIdx: number,
  opts: FuelOptions,
): number {
  let score = 0.4;
  score += Math.min(0.3, magnitudePct / 100);

  const movingDuring = points
    .slice(startIdx, Math.min(endIdx + 1, points.length))
    .some((p) => p.moving);
  if (!movingDuring) score += 0.2;
  else score -= 0.15;

  if (isStable(points, startIdx, -1, opts.stabilizationSec)) score += 0.1;
  if (isStable(points, Math.min(endIdx, points.length - 1), 1, opts.stabilizationSec)) score += 0.1;

  // Hizli dusus hirsizlik, yavas dusus normal tuketim isaretidir.
  if (kind === 'drop') {
    const litersPerMinute = magnitudePct / Math.max(1, durationSec / 60);
    if (litersPerMinute > 0.5) score += 0.15;
    else score -= 0.1;
  }

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function isStable(points: readonly FuelPoint[], index: number, direction: -1 | 1, windowSec: number): boolean {
  const anchor = points[index];
  if (!anchor) return false;
  let i = index + direction;
  let checked = 0;
  while (i >= 0 && i < points.length) {
    const p = points[i]!;
    const dt = Math.abs(p.ts.getTime() - anchor.ts.getTime()) / 1000;
    if (dt > windowSec) break;
    if (Math.abs(p.level - anchor.level) > 2) return false;
    checked += 1;
    i += direction;
  }
  return checked > 0;
}

/**
 * Donem icindeki tuketimi hesaplar.
 * Tuketim = (baslangic - bitis seviyesi) + donem icindeki dolumlar.
 */
export function estimateConsumption(
  samples: readonly PositionSample[],
  fills: readonly FuelEvent[],
  tankLiters: number,
): number {
  const withFuel = samples.filter((s) => typeof s.fuelLevelPct === 'number');
  const first = withFuel[0];
  const last = withFuel[withFuel.length - 1];
  if (!first || !last) return 0;

  const startL = (first.fuelLevelPct! * tankLiters) / 100;
  const endL = (last.fuelLevelPct! * tankLiters) / 100;
  const filled = fills.filter((f) => f.kind === 'fill').reduce((sum, f) => sum + f.liters, 0);
  return Math.max(0, Math.round((startL - endL + filled) * 10) / 10);
}

/** Saatlik ortalama tuketim (lt/saat) - bakim ve maliyet analizi icin. */
export function consumptionPerHour(litersUsed: number, engineSeconds: number): number {
  if (engineSeconds <= 0) return 0;
  return Math.round((litersUsed / (engineSeconds / 3600)) * 100) / 100;
}
