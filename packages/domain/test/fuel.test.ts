import { describe, expect, it } from 'vitest';
import { consumptionPerHour, detectFuelEvents, estimateConsumption, medianFilter } from '@medentry/domain';
import type { PositionSample } from '@medentry/shared';

const BASE = Date.UTC(2026, 8, 18, 4, 0, 0);

function sample(minute: number, fuelPct: number, speedKph = 0): PositionSample {
  return {
    assetId: 'EKS-01',
    ts: new Date(BASE + minute * 60_000),
    lat: 41.0,
    lon: 29.0,
    speedKph,
    fuelLevelPct: fuelPct,
  };
}

describe('medyan filtresi', () => {
  it('tek noktali sicramayi temizler', () => {
    const filtered = medianFilter([50, 50, 12, 50, 50], 5);
    expect(filtered[2]).toBe(50);
  });

  it('gercek rampayi korur', () => {
    const filtered = medianFilter([10, 20, 30, 40, 50], 3);
    expect(filtered[2]).toBe(30);
  });
});

describe('yakit olay tespiti', () => {
  it('normal tuketimi olay saymaz', () => {
    // 4 saatte %20 dusus - kademeli tuketim.
    const samples = Array.from({ length: 49 }, (_, i) => sample(i * 5, 90 - i * 0.4));

    const events = detectFuelEvents(samples, { tankLiters: 400 });

    expect(events.filter((e) => e.kind === 'drop' && e.confidence > 0.6)).toHaveLength(0);
  });

  it('yakit dolumunu tespit eder', () => {
    const samples = [
      ...Array.from({ length: 10 }, (_, i) => sample(i * 5, 30)),
      sample(50, 45),
      sample(55, 62),
      sample(60, 80),
      ...Array.from({ length: 10 }, (_, i) => sample(65 + i * 5, 80)),
    ];

    const events = detectFuelEvents(samples, { tankLiters: 400 });
    const fill = events.find((e) => e.kind === 'fill');

    expect(fill).toBeDefined();
    expect(fill!.levelBeforePct).toBeCloseTo(30, 0);
    expect(fill!.levelAfterPct).toBeCloseTo(80, 0);
    expect(fill!.liters).toBeCloseTo(200, 0); // %50 * 400 lt
    expect(fill!.confidence).toBeGreaterThan(0.6);
  });

  it('ani yakit dususunu yuksek guvenle isaretler', () => {
    // Makine dururken 10 dakikada %40 dusus: hirsizlik senaryosu.
    const samples = [
      ...Array.from({ length: 12 }, (_, i) => sample(i * 5, 85)),
      sample(60, 70),
      sample(65, 55),
      sample(70, 45),
      ...Array.from({ length: 12 }, (_, i) => sample(75 + i * 5, 45)),
    ];

    const events = detectFuelEvents(samples, { tankLiters: 400 });
    const drop = events.find((e) => e.kind === 'drop');

    expect(drop).toBeDefined();
    expect(drop!.liters).toBeCloseTo(160, 0);
    expect(drop!.confidence).toBeGreaterThan(0.7);
  });

  it('hareket halindeki calkantiyi dusuk guvenle degerlendirir', () => {
    const samples = [
      ...Array.from({ length: 12 }, (_, i) => sample(i * 5, 60, 60)),
      sample(60, 52, 60),
      sample(65, 46, 60),
      ...Array.from({ length: 6 }, (_, i) => sample(70 + i * 5, 46, 60)),
    ];

    const events = detectFuelEvents(samples, { tankLiters: 400 });
    const drop = events.find((e) => e.kind === 'drop');

    // Olay uretilebilir ama guven skoru alarm esiginin altinda kalmali.
    if (drop) expect(drop.confidence).toBeLessThan(0.75);
  });

  it('sensor sicramasini filtreleyip olay uretmez', () => {
    const samples = [
      ...Array.from({ length: 10 }, (_, i) => sample(i * 5, 70)),
      sample(50, 5), // tek noktali sensor hatasi
      ...Array.from({ length: 10 }, (_, i) => sample(55 + i * 5, 70)),
    ];

    const events = detectFuelEvents(samples, { tankLiters: 400 });

    expect(events).toHaveLength(0);
  });
});

describe('tuketim hesabi', () => {
  it('dolumlari hesaba katarak tuketimi bulur', () => {
    const samples = [sample(0, 80), sample(60, 40), sample(70, 90), sample(180, 60)];
    const fills = detectFuelEvents(samples, { tankLiters: 500 }).filter((e) => e.kind === 'fill');

    const used = estimateConsumption(samples, fills, 500);

    // (80-60)% = 100 lt + dolum sirasinda yakilan
    expect(used).toBeGreaterThan(95);
  });

  it('saatlik tuketimi hesaplar', () => {
    expect(consumptionPerHour(120, 8 * 3600)).toBe(15);
    expect(consumptionPerHour(120, 0)).toBe(0);
  });
});
