import { describe, expect, it } from 'vitest';
import { computeDailyBilling, roundHours, summarizePeriod } from '@medentry/domain';
import type { RateCard } from '@medentry/shared';

const hourly: RateCard = {
  id: 'rc-saatlik',
  name: 'Ekskavator - saatlik',
  currency: 'TRY',
  mode: 'hourly',
  hourlyRate: 1800,
  idleBillable: false,
  fuelIncluded: true,
  vatRate: 0.2,
};

const segment = (hours: number, idleHours = 0) => ({
  durationSec: hours * 3600,
  idleSec: idleHours * 3600,
  workingSec: (hours - idleHours) * 3600,
});

describe('gunluk hakedis', () => {
  it('saatlik tarifede efektif calisma saatini faturalar', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: hourly,
      segments: [segment(8, 1)],
    });

    expect(result.engineHours).toBe(8);
    expect(result.idleHours).toBe(1);
    expect(result.workingHours).toBe(7);
    expect(result.billableHours).toBe(7);
    expect(result.amountBase).toBe(12_600); // 7 * 1800
    expect(result.amountVat).toBe(2520);
    expect(result.amountTotal).toBe(15_120);
  });

  it('rolanti faturalanabilir ise motor saatini esas alir', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, idleBillable: true },
      segments: [segment(8, 1)],
    });

    expect(result.billableHours).toBe(8);
    expect(result.amountBase).toBe(14_400);
  });

  it('rolantiyi dusuk tarifeden ayri satirda ucretlendirir', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, idleHourlyRate: 600 },
      segments: [segment(8, 2)],
    });

    expect(result.amountBase).toBe(10_800); // 6 saat calisma
    expect(result.amountIdle).toBe(1200); // 2 saat rolanti
    expect(result.lines.map((l) => l.code)).toContain('rolanti');
  });

  it('gunluk asgari saat garantisini uygular', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, mode: 'hourly_with_min', minHoursPerDay: 8 },
      segments: [segment(5)],
    });

    expect(result.billableHours).toBe(8);
    expect(result.amountNet).toBe(14_400);
    const line = result.lines.find((l) => l.code === 'asgari_saat_farki');
    expect(line?.quantity).toBe(3);
  });

  it('hic calismadiysa asgari saat isletilmez', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-21',
      rateCard: { ...hourly, mode: 'hourly_with_min', minHoursPerDay: 8, transportFee: 5000 },
      segments: [],
    });

    expect(result.billableHours).toBe(0);
    expect(result.amountTotal).toBe(0);
  });

  it('mesai saatlerini carpanla ucretlendirir', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, overtimeAfterHours: 8, overtimeMultiplier: 1.5 },
      segments: [segment(11)],
    });

    expect(result.normalHours).toBe(8);
    expect(result.overtimeHours).toBe(3);
    expect(result.amountBase).toBe(14_400); // 8 * 1800
    expect(result.amountOvertime).toBe(8100); // 3 * 2700
    expect(result.amountNet).toBe(22_500);
  });

  it('gunluk goturu tarifede sabit bedel uygular', () => {
    const daily: RateCard = {
      id: 'rc-gunluk',
      name: 'Kamyon - gunluk',
      currency: 'TRY',
      mode: 'daily',
      dailyRate: 9000,
      hourlyRate: 1200,
      overtimeAfterHours: 9,
      overtimeMultiplier: 1.5,
      idleBillable: true,
      fuelIncluded: true,
    };

    const result = computeDailyBilling({
      assetId: 'KMY-03',
      dateKey: '2026-09-18',
      rateCard: daily,
      segments: [segment(11)],
    });

    expect(result.amountBase).toBe(9000);
    expect(result.overtimeHours).toBe(2);
    expect(result.amountOvertime).toBe(3600); // 2 * 1800
  });

  it('yakit dahil degilse tuketimi hakedise ekler', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, fuelIncluded: false, fuelPricePerLiter: 45.5 },
      segments: [segment(8)],
      fuelUsedLiters: 120,
    });

    expect(result.amountFuel).toBe(5460);
    expect(result.lines.find((l) => l.code === 'yakit')?.quantity).toBe(120);
  });

  it('nakliye bedelini yalnizca calisilan gune ekler', () => {
    const worked = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, transportFee: 7500 },
      segments: [segment(4)],
    });
    const idleDay = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-19',
      rateCard: { ...hourly, transportFee: 7500 },
      segments: [],
    });

    expect(worked.amountTransport).toBe(7500);
    expect(idleDay.amountTransport).toBe(0);
  });

  it('15 dakikalik dilimlere yukari yuvarlar', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: { ...hourly, roundingStepHours: 0.25, roundingMode: 'up' },
      segments: [{ durationSec: 7 * 3600 + 60, idleSec: 0, workingSec: 7 * 3600 + 60 }],
    });

    expect(result.billableHours).toBe(7.25);
  });

  it('elle duzeltmeyi hesaba katar', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: hourly,
      segments: [segment(6)],
      manualAdjustHours: -1,
      manualAdjustNote: 'Ariza nedeniyle 1 saat dusuldu',
    });

    expect(result.billableHours).toBe(5);
    expect(result.amountNet).toBe(9000);
  });

  it('aylik kirayi gune boler', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-02',
      dateKey: '2026-09-18',
      rateCard: {
        id: 'rc-aylik',
        name: 'Aylik kira',
        currency: 'TRY',
        mode: 'monthly',
        monthlyRate: 260_000,
        workingDaysPerMonth: 26,
        idleBillable: true,
        fuelIncluded: true,
      },
      segments: [segment(9)],
    });

    expect(result.amountBase).toBe(10_000);
  });

  it('hesap satirlari toplami net tutari verir', () => {
    const result = computeDailyBilling({
      assetId: 'EKS-01',
      dateKey: '2026-09-18',
      rateCard: {
        ...hourly,
        mode: 'hourly_with_min',
        minHoursPerDay: 8,
        overtimeAfterHours: 9,
        overtimeMultiplier: 1.5,
        transportFee: 2000,
        fuelIncluded: false,
        fuelPricePerLiter: 45,
        idleHourlyRate: 500,
      },
      segments: [segment(11, 1)],
      fuelUsedLiters: 90,
    });

    const sum = result.lines.reduce((acc, line) => acc + line.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.amountNet);
  });

  it('donem icmalini toplar', () => {
    const days = ['2026-09-16', '2026-09-17', '2026-09-18'].map((dateKey, index) =>
      computeDailyBilling({
        assetId: 'EKS-01',
        dateKey,
        rateCard: hourly,
        segments: index === 1 ? [] : [segment(8)],
      }),
    );

    const summary = summarizePeriod(days);

    expect(summary.days).toBe(3);
    expect(summary.workedDays).toBe(2);
    expect(summary.billableHours).toBe(16);
    expect(summary.amountTotal).toBe(34_560);
  });
});

describe('saat yuvarlama', () => {
  it('yukari yuvarlar', () => {
    expect(roundHours(7.01, 0.25, 'up')).toBe(7.25);
  });
  it('en yakina yuvarlar', () => {
    expect(roundHours(7.1, 0.25, 'nearest')).toBe(7);
    expect(roundHours(7.2, 0.25, 'nearest')).toBe(7.25);
  });
  it('adim yoksa oldugu gibi birakir', () => {
    expect(roundHours(7.123)).toBe(7.12);
  });
});
