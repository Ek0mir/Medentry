import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  localDateKey,
  localDayRange,
  localIsoWeekday,
  minutesIntoLocalDay,
  overlapSeconds,
  secondsToHours,
  startOfLocalDay,
  timezoneOffsetMinutes,
} from '@medentry/shared';
import { haversineMeters, isValidFix, pointInPolygon, polygonAreaSqMeters } from '@medentry/shared';

describe('saat dilimi', () => {
  it('Turkiye icin UTC+3 ofseti verir', () => {
    expect(timezoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(180);
    expect(timezoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(180);
  });

  it('gun anahtarini yerel saate gore hesaplar', () => {
    // 21:30 UTC = ertesi gun 00:30 Turkiye saati
    expect(localDateKey(new Date('2026-09-18T21:30:00Z'))).toBe('2026-09-19');
    expect(localDateKey(new Date('2026-09-18T20:30:00Z'))).toBe('2026-09-18');
  });

  it('yerel gun basini UTC olarak verir', () => {
    expect(startOfLocalDay(new Date('2026-09-18T15:00:00Z')).toISOString()).toBe('2026-09-17T21:00:00.000Z');
  });

  it('gun araligini 24 saat olarak dondurur', () => {
    const { start, end } = localDayRange('2026-09-18');
    expect(start.toISOString()).toBe('2026-09-17T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-18T21:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(24);
  });

  it('gun ici dakikayi ve hafta gununu yerel saatte verir', () => {
    expect(minutesIntoLocalDay(new Date('2026-09-18T07:15:00Z'))).toBe(10 * 60 + 15);
    expect(localIsoWeekday(new Date('2026-09-18T07:00:00Z'))).toBe(5); // Cuma
    expect(localIsoWeekday(new Date('2026-09-20T07:00:00Z'))).toBe(7); // Pazar
  });

  it('sure bicimlendirmesi', () => {
    expect(formatDuration(27_120)).toBe('7s 32d');
    expect(formatDuration(900)).toBe('15d');
    expect(formatDuration(45)).toBe('45sn');
    expect(secondsToHours(27_000)).toBe(7.5);
  });

  it('aralik kesisimini hesaplar', () => {
    const a1 = new Date('2026-09-18T06:00:00Z');
    const a2 = new Date('2026-09-18T10:00:00Z');
    const b1 = new Date('2026-09-18T09:00:00Z');
    const b2 = new Date('2026-09-18T12:00:00Z');

    expect(overlapSeconds(a1, a2, b1, b2)).toBe(3600);
    expect(overlapSeconds(a1, a2, b2, new Date('2026-09-18T13:00:00Z'))).toBe(0);
  });
});

describe('cografi hesaplar', () => {
  it('mesafeyi dogru olcer', () => {
    // Istanbul - Ankara yaklasik 351 km
    const d = haversineMeters({ lat: 41.0082, lon: 28.9784 }, { lat: 39.9334, lon: 32.8597 });
    expect(d / 1000).toBeGreaterThan(340);
    expect(d / 1000).toBeLessThan(360);
  });

  it('poligon ici testi', () => {
    const kare = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
    ];
    expect(pointInPolygon({ lat: 0.5, lon: 0.5 }, kare)).toBe(true);
    expect(pointInPolygon({ lat: 1.5, lon: 0.5 }, kare)).toBe(false);
  });

  it('poligon alanini yaklasik hesaplar', () => {
    // ~0.01 derece ~ 1.1 km; 1.1 km x 0.83 km ~ 0.9 km2 (41. enlemde)
    const alan = polygonAreaSqMeters([
      { lat: 41.0, lon: 29.0 },
      { lat: 41.0, lon: 29.01 },
      { lat: 41.01, lon: 29.01 },
      { lat: 41.01, lon: 29.0 },
    ]);
    expect(alan).toBeGreaterThan(700_000);
    expect(alan).toBeLessThan(1_100_000);
  });

  it('gecersiz GPS fix tespiti', () => {
    expect(isValidFix({ lat: 41, lon: 29 })).toBe(true);
    expect(isValidFix({ lat: 0, lon: 0 })).toBe(false); // fix yok
    expect(isValidFix({ lat: 95, lon: 29 })).toBe(false);
    expect(isValidFix(null)).toBe(false);
  });
});
