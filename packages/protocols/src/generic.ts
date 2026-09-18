/**
 * Genel JSON telemetri girisi.
 *
 * Kendi gelistirdigimiz cihazlar, operator telefon uygulamasi veya ucuncu
 * parti platformlardan HTTPS ile gelen veriler icin kullanilir.
 * Sema esnektir; bilinen alan adlarinin yaygin varyantlari kabul edilir.
 */

import type { AlarmCode, NormalizedRecord } from '@medentry/shared';

export interface GenericPayload {
  [key: string]: unknown;
}

const NUMBER_KEYS: Record<string, string[]> = {
  speedKph: ['speed', 'speedKph', 'speed_kph', 'hiz'],
  headingDeg: ['heading', 'course', 'bearing', 'yon'],
  altitudeM: ['altitude', 'alt'],
  satellites: ['satellites', 'sats'],
  hdop: ['hdop'],
  odometerM: ['odometer', 'odometerM', 'km'],
  engineHoursSec: ['engineHours', 'engine_hours', 'motorSaati'],
  fuelLevelPct: ['fuelLevel', 'fuel_pct', 'fuelPercent', 'yakitYuzde'],
  fuelLevelLiters: ['fuelLiters', 'fuel_liters', 'yakitLitre'],
  fuelUsedLiters: ['fuelUsed', 'fuel_used'],
  engineRpm: ['rpm', 'engineRpm'],
  coolantTempC: ['coolantTemp', 'engineTemp'],
  batteryV: ['battery', 'batteryV', 'aku'],
  externalV: ['externalV', 'power', 'voltage'],
  gsmSignal: ['gsm', 'signal', 'rssi'],
};

/** Tek bir JSON kaydini normalize eder. Gecersizse hata firlatir. */
export function normalizeGeneric(payload: GenericPayload): NormalizedRecord {
  const deviceIdent = str(payload, ['deviceId', 'device_id', 'imei', 'ident', 'id']);
  if (!deviceIdent) throw new Error('deviceId/imei alani zorunlu');

  const lat = num(payload, ['lat', 'latitude', 'enlem']);
  const lon = num(payload, ['lon', 'lng', 'longitude', 'boylam']);
  const tsValue = payload['ts'] ?? payload['timestamp'] ?? payload['time'] ?? payload['zaman'];
  const timestamp = parseTimestamp(tsValue);

  const record: NormalizedRecord = {
    deviceIdent,
    protocol: 'generic',
    timestamp,
    gpsValid: typeof lat === 'number' && typeof lon === 'number',
    raw: payload as Record<string, unknown>,
  };
  if (typeof lat === 'number' && typeof lon === 'number') {
    record.position = { lat, lon };
  }

  for (const [field, keys] of Object.entries(NUMBER_KEYS)) {
    const value = num(payload, keys);
    if (value !== undefined) (record as unknown as Record<string, unknown>)[field] = value;
  }

  const ignition = bool(payload, ['ignition', 'acc', 'kontak']);
  if (ignition !== undefined) record.ignition = ignition;
  const movement = bool(payload, ['movement', 'moving', 'hareket']);
  if (movement !== undefined) record.movement = movement;

  const alarms = payload['alarms'] ?? payload['alarm'];
  if (Array.isArray(alarms)) {
    record.alarms = alarms.filter((a): a is AlarmCode => typeof a === 'string') as AlarmCode[];
  } else if (typeof alarms === 'string') {
    record.alarms = [alarms as AlarmCode];
  }

  return record;
}

/** Dizi veya tekil payload'i normalize eder. */
export function normalizeGenericBatch(payload: GenericPayload | GenericPayload[]): NormalizedRecord[] {
  const items = Array.isArray(payload) ? payload : [payload];
  return items.map(normalizeGeneric);
}

function str(payload: GenericPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function num(payload: GenericPayload, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function bool(payload: GenericPayload, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (['1', 'true', 'on', 'acik', 'evet'].includes(v)) return true;
      if (['0', 'false', 'off', 'kapali', 'hayir'].includes(v)) return false;
    }
  }
  return undefined;
}

function parseTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // 10 haneli degerler saniye, 13 haneli degerler milisaniye kabul edilir.
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
