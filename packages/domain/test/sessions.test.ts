import { describe, expect, it } from 'vitest';
import { buildWorkSessions, deriveIgnition, DEFAULT_SESSION_OPTIONS } from '@medentry/domain';
import type { SessionSample } from '@medentry/domain';

const ASSET = 'EKS-01';
const BASE = Date.UTC(2026, 8, 18, 4, 0, 0); // 07:00 Turkiye saati

interface SampleSpec {
  minute: number;
  ignition: boolean;
  speedKph?: number;
  rpm?: number;
  lat?: number;
  lon?: number;
  fuelPct?: number;
}

function sample(spec: SampleSpec): SessionSample {
  const s: SessionSample = {
    assetId: ASSET,
    ts: new Date(BASE + spec.minute * 60_000),
    lat: spec.lat ?? 41.0,
    lon: spec.lon ?? 29.0,
    speedKph: spec.speedKph ?? 0,
    ignition: spec.ignition,
  };
  if (spec.rpm !== undefined) s.engineRpm = spec.rpm;
  if (spec.fuelPct !== undefined) s.fuelLevelPct = spec.fuelPct;
  return s;
}

/** [baslangic, bitis) dakikalari arasinda dakikada bir kayit uretir. */
function series(fromMin: number, toMin: number, spec: Omit<SampleSpec, 'minute'>): SessionSample[] {
  const out: SessionSample[] = [];
  for (let m = fromMin; m < toMin; m += 1) out.push(sample({ ...spec, minute: m }));
  return out;
}

describe('calisma oturumu motoru', () => {
  it('kontak ac/kapa arasindaki sureyi oturum olarak uretir', () => {
    const samples = [
      ...series(0, 120, { ignition: true, rpm: 1600 }), // 07:00-09:00 calisma
      sample({ minute: 120, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSec).toBe(120 * 60);
    expect(sessions[0]?.open).toBe(false);
    expect(sessions[0]?.startedAt.toISOString()).toBe(new Date(BASE).toISOString());
  });

  it('kisa kontak kapamalarini tek oturumda birlestirir', () => {
    // Operator yakit almak icin 2 dakika kontagi kapatiyor.
    const samples = [
      ...series(0, 60, { ignition: true, rpm: 1500 }),
      sample({ minute: 60, ignition: false }),
      sample({ minute: 62, ignition: true, rpm: 1500 }),
      ...series(63, 120, { ignition: true, rpm: 1500 }),
      sample({ minute: 120, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples, { mergeGapSec: 180 });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSec).toBe(120 * 60);
  });

  it('uzun ogle molasini ayri oturumlara boler', () => {
    const samples = [
      ...series(0, 300, { ignition: true, rpm: 1500 }), // 07:00-12:00
      sample({ minute: 300, ignition: false }),
      ...series(360, 600, { ignition: true, rpm: 1500 }), // 13:00-17:00
      sample({ minute: 600, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.durationSec).toBe(300 * 60);
    expect(sessions[1]?.durationSec).toBe(240 * 60);
  });

  it('is makinesinde rolantiyi motor devrinden ayirt eder', () => {
    // Ekskavator: hiz her zaman 0 ama devir calismayi gosterir.
    const samples = [
      ...series(0, 60, { ignition: true, rpm: 1700 }), // 1 saat kazi
      ...series(60, 90, { ignition: true, rpm: 750 }), // 30 dk rolanti
      ...series(90, 120, { ignition: true, rpm: 1700 }), // 30 dk kazi
      sample({ minute: 120, ignition: false }),
    ];

    const { sessions, idlePeriods } = buildWorkSessions(samples, { idle: { ...DEFAULT_SESSION_OPTIONS.idle, minSec: 300 } });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSec).toBe(7200);
    expect(sessions[0]?.idleSec).toBe(30 * 60);
    expect(sessions[0]?.workingSec).toBe(90 * 60);
    expect(idlePeriods).toHaveLength(1);
  });

  it('hiz tabanli rolantiyi yol araclarinda uygular', () => {
    const samples = [
      ...series(0, 30, { ignition: true, speedKph: 50 }),
      ...series(30, 50, { ignition: true, speedKph: 0 }), // 20 dk rolanti
      ...series(50, 80, { ignition: true, speedKph: 45 }),
      sample({ minute: 80, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples, {
      idle: { ...DEFAULT_SESSION_OPTIONS.idle, strategy: 'speed', minSec: 300 },
    });

    expect(sessions[0]?.idleSec).toBe(20 * 60);
    expect(sessions[0]?.workingSec).toBe(60 * 60);
  });

  it('kisa duraklamalari rolanti saymaz', () => {
    const samples = [
      ...series(0, 30, { ignition: true, speedKph: 40 }),
      ...series(30, 33, { ignition: true, speedKph: 0 }), // 3 dk trafik ısıgı
      ...series(33, 60, { ignition: true, speedKph: 40 }),
      sample({ minute: 60, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples, {
      idle: { ...DEFAULT_SESSION_OPTIONS.idle, strategy: 'speed', minSec: 300 },
    });

    expect(sessions[0]?.idleSec).toBe(0);
  });

  it('veri kesintisinde oturumu son bilinen kayitta kapatir', () => {
    // Cihaz 08:00'de susuyor, 11:00'de geri geliyor: aradaki 3 saat
    // calisma saati olarak faturalanmamali.
    const samples = [
      ...series(0, 60, { ignition: true, rpm: 1500 }),
      ...series(240, 300, { ignition: true, rpm: 1500 }),
      sample({ minute: 300, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples, { maxDataGapSec: 1800 });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.durationSec).toBe(59 * 60); // son kayda kadar
    expect(sessions[0]?.open).toBe(false);
    expect(sessions[1]?.durationSec).toBe(60 * 60);
  });

  it('kapanmamis oturumu acik olarak isaretler', () => {
    const { sessions } = buildWorkSessions(series(0, 45, { ignition: true, rpm: 1500 }));

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.open).toBe(true);
    expect(sessions[0]?.endedAt).toBeNull();
  });

  it('mesafeyi hesaplar ve GPS sicramalarini eler', () => {
    const samples: SessionSample[] = [
      sample({ minute: 0, ignition: true, speedKph: 50, lat: 41.0, lon: 29.0 }),
      sample({ minute: 1, ignition: true, speedKph: 50, lat: 41.01, lon: 29.0 }),
      // Sicrama: 500 km oteye tek adim - mesafeye katilmamali.
      sample({ minute: 2, ignition: true, speedKph: 50, lat: 45.5, lon: 29.0 }),
      sample({ minute: 3, ignition: true, speedKph: 50, lat: 41.02, lon: 29.0 }),
      sample({ minute: 4, ignition: false, lat: 41.02, lon: 29.0 }),
    ];

    const { sessions } = buildWorkSessions(samples);

    // ~1.1 km + ~1.1 km (sicrama ve donusu atlanir)
    expect(sessions[0]?.distanceM).toBeGreaterThan(1000);
    expect(sessions[0]?.distanceM).toBeLessThan(3000);
  });

  it('yakit seviyesi baslangic/bitisini oturuma yazar', () => {
    const samples = [
      sample({ minute: 0, ignition: true, rpm: 1500, fuelPct: 90 }),
      sample({ minute: 30, ignition: true, rpm: 1500, fuelPct: 85 }),
      sample({ minute: 60, ignition: true, rpm: 1500, fuelPct: 78 }),
      sample({ minute: 61, ignition: false, fuelPct: 78 }),
    ];

    const { sessions } = buildWorkSessions(samples);

    expect(sessions[0]?.fuelStartPct).toBe(90);
    expect(sessions[0]?.fuelEndPct).toBe(78);
  });

  it('cok kisa oturumlari gurultu sayip atar', () => {
    const samples = [
      sample({ minute: 0, ignition: true, rpm: 800 }),
      sample({ minute: 0.5, ignition: false }),
      ...series(10, 70, { ignition: true, rpm: 1500 }),
      sample({ minute: 70, ignition: false }),
    ];

    const { sessions } = buildWorkSessions(samples, { minSessionSec: 60 });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSec).toBe(60 * 60);
  });
});

describe('kontak turetme', () => {
  const base = { assetId: ASSET, ts: new Date(BASE), lat: 41, lon: 29, speedKph: 0 };

  it('cihaz bildirimini oncelikler', () => {
    expect(deriveIgnition({ ...base, ignition: false, speedKph: 80 }, DEFAULT_SESSION_OPTIONS)).toBe(false);
  });

  it('kontak bilgisi yoksa harici voltajdan turetir', () => {
    expect(deriveIgnition({ ...base, externalV: 13.8 }, DEFAULT_SESSION_OPTIONS)).toBe(true);
    expect(deriveIgnition({ ...base, externalV: 12.3 }, DEFAULT_SESSION_OPTIONS)).toBe(false);
  });

  it('motor devri varsa kontak acik kabul eder', () => {
    expect(deriveIgnition({ ...base, engineRpm: 700 }, DEFAULT_SESSION_OPTIONS)).toBe(true);
  });

  it('son care olarak hiza bakar', () => {
    expect(deriveIgnition({ ...base, speedKph: 30 }, DEFAULT_SESSION_OPTIONS)).toBe(true);
    expect(deriveIgnition({ ...base, speedKph: 0 }, DEFAULT_SESSION_OPTIONS)).toBe(false);
  });
});
