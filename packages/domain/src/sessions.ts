/**
 * Calisma oturumu (kontak ac/kapa) motoru.
 *
 * Girdi: bir varliga ait zaman sirali konum kayitlari.
 * Cikti: kontak acik gecen oturumlar + rolanti araliklari.
 *
 * Bu modul saf fonksiyonlardan olusur; veritabani veya saat bagimliligi
 * yoktur, dolayisiyla dogrudan test edilebilir.
 */

import { haversineMeters, isValidFix, type LatLon } from '@medentry/shared';
import type { IdlePeriod, PositionSample, WorkSession } from '@medentry/shared';

/**
 * Rolanti tespiti stratejisi.
 *
 * Onemli: is makinelerinde (ekskavator gibi) makine calisirken hiz sifirdir.
 * Hiz tabanli rolanti tespiti bu makineler icin YANLIS sonuc verir; motor
 * devri (CAN/RPM) veya titresim/hareket sensoru kullanilmalidir.
 *  - `speed`    : hiz esigi (kamyon, pickup gibi yol araclari icin)
 *  - `rpm`      : motor devri esigi (CAN verisi olan is makineleri)
 *  - `movement` : cihazin hareket/titresim sensoru (CAN yoksa is makineleri)
 *  - `auto`     : rpm -> movement -> speed sirasiyla mevcut olani secer
 */
export type IdleStrategy = 'speed' | 'rpm' | 'movement' | 'auto';

export interface IdleOptions {
  strategy: IdleStrategy;
  /** Bu surenin altindaki duraklamalar rolanti sayilmaz (saniye). */
  minSec: number;
  speedThresholdKph: number;
  rpmThreshold: number;
}

export interface SessionOptions {
  /** Kontagin bu sureden kisa kapali kalmasi oturumu bolmez (saniye). */
  mergeGapSec: number;
  /** Bu surenin altindaki oturumlar gurultu sayilir ve atilir (saniye). */
  minSessionSec: number;
  /** Veri kesintisi bu sureyi asarsa oturum son bilinen kayitta kapatilir. */
  maxDataGapSec: number;
  /** Kontak bilgisi olmayan cihazlarda harici voltaj esigi (alternator sarji). */
  ignitionVoltageThreshold: number;
  idle: IdleOptions;
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  mergeGapSec: 180,
  minSessionSec: 60,
  maxDataGapSec: 1800,
  ignitionVoltageThreshold: 13.0,
  idle: {
    strategy: 'auto',
    minSec: 300,
    speedThresholdKph: 2,
    rpmThreshold: 900,
  },
};

export interface SessionBuildResult {
  sessions: WorkSession[];
  idlePeriods: IdlePeriod[];
}

/** Ek alanlarla genisletilmis ornek (CAN verisi opsiyonel). */
export interface SessionSample extends PositionSample {
  engineRpm?: number;
}

/**
 * Kontak durumunu belirler. Cihaz dogrudan bildiriyorsa o kullanilir;
 * bildirmiyorsa harici voltaj / hareket / hiz uzerinden turetilir.
 */
export function deriveIgnition(sample: SessionSample, opts: SessionOptions): boolean {
  if (typeof sample.ignition === 'boolean') return sample.ignition;
  if (typeof sample.engineRpm === 'number' && sample.engineRpm > 0) return true;
  if (typeof sample.externalV === 'number' && sample.externalV >= opts.ignitionVoltageThreshold) return true;
  if (sample.movement === true) return true;
  return sample.speedKph > opts.idle.speedThresholdKph;
}

/** Bir ornek "durgun" (rolanti adayi) mi? */
export function isStationary(sample: SessionSample, idle: IdleOptions): boolean {
  const strategy = resolveStrategy(sample, idle.strategy);
  switch (strategy) {
    case 'rpm':
      return (sample.engineRpm ?? 0) < idle.rpmThreshold;
    case 'movement':
      return sample.movement !== true && sample.speedKph <= idle.speedThresholdKph;
    case 'speed':
    default:
      return sample.speedKph <= idle.speedThresholdKph;
  }
}

function resolveStrategy(sample: SessionSample, strategy: IdleStrategy): Exclude<IdleStrategy, 'auto'> {
  if (strategy !== 'auto') return strategy;
  if (typeof sample.engineRpm === 'number') return 'rpm';
  if (typeof sample.movement === 'boolean') return 'movement';
  return 'speed';
}

interface Run {
  samples: SessionSample[];
  /** Kontagin kapandigi an (bir sonraki kapali kayittan gelir). */
  closedAt: Date | null;
}

/**
 * Zaman sirali kayitlardan calisma oturumlarini uretir.
 * `samples` artan zamana gore sirali olmalidir.
 */
export function buildWorkSessions(
  samples: readonly SessionSample[],
  options: Partial<SessionOptions> = {},
): SessionBuildResult {
  const opts = mergeOptions(options);
  if (samples.length === 0) return { sessions: [], idlePeriods: [] };

  const ordered = [...samples].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const runs = collectRuns(ordered, opts);
  const merged = mergeCloseRuns(runs, opts);

  const sessions: WorkSession[] = [];
  const idlePeriods: IdlePeriod[] = [];

  for (const run of merged) {
    const built = buildSession(run, opts);
    if (!built) continue;
    if (built.session.durationSec < opts.minSessionSec && !built.session.open) continue;
    sessions.push(built.session);
    idlePeriods.push(...built.idlePeriods);
  }

  return { sessions, idlePeriods };
}

function mergeOptions(partial: Partial<SessionOptions>): SessionOptions {
  return {
    ...DEFAULT_SESSION_OPTIONS,
    ...partial,
    idle: { ...DEFAULT_SESSION_OPTIONS.idle, ...(partial.idle ?? {}) },
  };
}

/** Kontak acik gecen kesintisiz kayit gruplarini cikarir. */
function collectRuns(samples: readonly SessionSample[], opts: SessionOptions): Run[] {
  const runs: Run[] = [];
  let current: SessionSample[] = [];

  const flush = (closedAt: Date | null): void => {
    if (current.length > 0) {
      runs.push({ samples: current, closedAt });
      current = [];
    }
  };

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]!;
    const on = deriveIgnition(sample, opts);

    if (!on) {
      flush(sample.ts);
      continue;
    }

    const last = current[current.length - 1];
    if (last) {
      const gapSec = (sample.ts.getTime() - last.ts.getTime()) / 1000;
      // Veri kesintisi: cihaz sustu. Oturumu son bilinen kayitta kapatiyoruz,
      // aksi halde kesinti suresi calisma saati gibi faturalanir.
      if (gapSec > opts.maxDataGapSec) {
        flush(last.ts);
      }
    }
    current.push(sample);
  }
  flush(null);

  return runs;
}

/** Kisa kontak kapamalari (yakit alma, mola) tek oturumda birlestirilir. */
function mergeCloseRuns(runs: readonly Run[], opts: SessionOptions): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ samples: [...run.samples], closedAt: run.closedAt });
      continue;
    }
    const prevEnd = prev.closedAt ?? prev.samples[prev.samples.length - 1]!.ts;
    const nextStart = run.samples[0]!.ts;
    const gapSec = (nextStart.getTime() - prevEnd.getTime()) / 1000;
    if (gapSec >= 0 && gapSec <= opts.mergeGapSec) {
      prev.samples.push(...run.samples);
      prev.closedAt = run.closedAt;
    } else {
      out.push({ samples: [...run.samples], closedAt: run.closedAt });
    }
  }
  return out;
}

function buildSession(
  run: Run,
  opts: SessionOptions,
): { session: WorkSession; idlePeriods: IdlePeriod[] } | null {
  const samples = run.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return null;

  const startedAt = first.ts;
  const endedAt = run.closedAt ?? last.ts;
  const open = run.closedAt === null;
  const durationSec = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000);

  let distanceM = 0;
  let prevFix: LatLon | null = isValidFix(first) ? { lat: first.lat, lon: first.lon } : null;
  for (let i = 1; i < samples.length; i += 1) {
    const s = samples[i]!;
    if (!isValidFix(s)) continue;
    const fix = { lat: s.lat, lon: s.lon };
    if (prevFix) {
      const step = haversineMeters(prevFix, fix);
      // 2 km'den buyuk tek adimlar GPS sicramasidir, mesafeye katilmaz.
      if (step < 2000) distanceM += step;
    }
    prevFix = fix;
  }

  const idlePeriods = collectIdlePeriods(samples, endedAt, opts.idle);
  const idleSec = idlePeriods.reduce((sum, p) => sum + p.durationSec, 0);

  const session: WorkSession = {
    assetId: first.assetId,
    startedAt,
    endedAt: open ? null : endedAt,
    durationSec,
    idleSec: Math.min(idleSec, durationSec),
    workingSec: Math.max(0, durationSec - Math.min(idleSec, durationSec)),
    distanceM: Math.round(distanceM),
    open,
  };

  if (isValidFix(first)) session.startPosition = { lat: first.lat, lon: first.lon };
  if (isValidFix(last)) session.endPosition = { lat: last.lat, lon: last.lon };

  const fuelStart = firstDefined(samples, (s) => s.fuelLevelPct);
  const fuelEnd = lastDefined(samples, (s) => s.fuelLevelPct);
  if (fuelStart !== undefined) session.fuelStartPct = fuelStart;
  if (fuelEnd !== undefined) session.fuelEndPct = fuelEnd;

  const litersStart = firstDefined(samples, (s) => s.fuelLevelLiters);
  const litersEnd = lastDefined(samples, (s) => s.fuelLevelLiters);
  if (litersStart !== undefined && litersEnd !== undefined && litersStart >= litersEnd) {
    session.fuelUsedLiters = Math.round((litersStart - litersEnd) * 100) / 100;
  }

  return { session, idlePeriods };
}

function collectIdlePeriods(
  samples: readonly SessionSample[],
  sessionEnd: Date,
  idle: IdleOptions,
): IdlePeriod[] {
  const periods: IdlePeriod[] = [];
  let runStartIndex = -1;

  const closeRun = (endTs: Date): void => {
    if (runStartIndex < 0) return;
    const start = samples[runStartIndex]!;
    const durationSec = (endTs.getTime() - start.ts.getTime()) / 1000;
    if (durationSec >= idle.minSec) {
      const period: IdlePeriod = {
        startedAt: start.ts,
        endedAt: endTs,
        durationSec,
      };
      if (isValidFix(start)) period.position = { lat: start.lat, lon: start.lon };
      periods.push(period);
    }
    runStartIndex = -1;
  };

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]!;
    if (isStationary(sample, idle)) {
      if (runStartIndex < 0) runStartIndex = i;
    } else {
      closeRun(sample.ts);
    }
  }
  // Oturum sonunda hala durgunsa, oturum bitisine kadar rolanti sayilir.
  closeRun(sessionEnd);

  return periods;
}

function firstDefined<T>(samples: readonly SessionSample[], pick: (s: SessionSample) => T | undefined): T | undefined {
  for (const s of samples) {
    const v = pick(s);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function lastDefined<T>(samples: readonly SessionSample[], pick: (s: SessionSample) => T | undefined): T | undefined {
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const v = pick(samples[i]!);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Oturumlardan gunluk toplam sureleri cikarir.
 * Gece yarisini asan oturumlar gunlere oransal bolunur.
 */
export function splitSessionAcrossDays(
  session: WorkSession,
  dayBoundaries: readonly Date[],
): Array<{ start: Date; end: Date; durationSec: number; idleSec: number; workingSec: number }> {
  const end = session.endedAt ?? new Date();
  const points = [session.startedAt, ...dayBoundaries.filter((d) => d > session.startedAt && d < end), end];
  const parts: Array<{ start: Date; end: Date; durationSec: number; idleSec: number; workingSec: number }> = [];
  const total = Math.max(1, (end.getTime() - session.startedAt.getTime()) / 1000);

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]!;
    const stop = points[i + 1]!;
    const durationSec = (stop.getTime() - start.getTime()) / 1000;
    if (durationSec <= 0) continue;
    const ratio = durationSec / total;
    const idleSec = session.idleSec * ratio;
    parts.push({
      start,
      end: stop,
      durationSec,
      idleSec,
      workingSec: Math.max(0, durationSec - idleSec),
    });
  }
  return parts;
}
