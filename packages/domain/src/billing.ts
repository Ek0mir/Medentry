/**
 * Gunluk hakedis hesabi.
 *
 * Telemetriden gelen calisma saatini sozlesme kosullarina (tarife karti)
 * gore ucrete cevirir. Her hesap, denetlenebilir olmasi icin satir satir
 * (BillingLine) aciklanir; fatura eki olarak musteriye sunulabilir.
 *
 * Tasarim kurali: hesaplama saf fonksiyondur, girdi disinda hicbir kaynaga
 * bakmaz. Boylece ayni girdi her zaman ayni hakedisi uretir ve
 * itiraz durumunda gecmise donuk yeniden hesap yapilabilir.
 */

import { secondsToHours } from '@medentry/shared';
import type { BillingLine, DailyBilling, RateCard, WorkSession } from '@medentry/shared';

export interface DailyBillingInput {
  assetId: string;
  dateKey: string;
  rateCard: RateCard;
  /** Gune kirpilmis oturum parcalari. */
  segments: Array<{ durationSec: number; idleSec: number; workingSec: number }>;
  fuelUsedLiters?: number;
  /** Santiyede (geofence icinde) gecen sure - bilgi amacli raporlanir. */
  siteSeconds?: number;
  /** Elle duzeltme (saat). Santiye sefi onayiyla eklenir/cikarilir. */
  manualAdjustHours?: number;
  manualAdjustNote?: string;
}

/** Tek gun icin hakedis hesaplar. */
export function computeDailyBilling(input: DailyBillingInput): DailyBilling {
  const { rateCard: rc } = input;
  const engineSec = sum(input.segments.map((s) => s.durationSec));
  const idleSec = sum(input.segments.map((s) => s.idleSec));
  const workingSec = sum(input.segments.map((s) => s.workingSec));

  const engineHours = secondsToHours(engineSec);
  const idleHours = secondsToHours(idleSec);
  const workingHours = secondsToHours(workingSec);
  const worked = engineSec > 0;

  // 1) Faturalanabilir ham saat: rolanti dahil mi degil mi?
  let rawBillable = rc.idleBillable ? engineHours : workingHours;
  if (input.manualAdjustHours) rawBillable += input.manualAdjustHours;
  rawBillable = Math.max(0, rawBillable);

  // 2) Yuvarlama (or. 15 dakikalik dilimler).
  let billableHours = roundHours(rawBillable, rc.roundingStepHours, rc.roundingMode);

  // 3) Gunluk asgari (garanti) saat.
  const minHours = rc.mode === 'hourly_with_min' ? (rc.minHoursPerDay ?? 0) : 0;
  let minimumApplied = 0;
  if (worked && minHours > 0 && billableHours < minHours) {
    minimumApplied = Math.round((minHours - billableHours) * 100) / 100;
    billableHours = minHours;
  }

  // 4) Normal / mesai ayrimi.
  const overtimeAfter = rc.overtimeAfterHours ?? Number.POSITIVE_INFINITY;
  const normalHours = Math.min(billableHours, overtimeAfter);
  const overtimeHours = Math.max(0, Math.round((billableHours - normalHours) * 100) / 100);

  const lines: BillingLine[] = [];
  let amountBase = 0;
  let amountOvertime = 0;

  switch (rc.mode) {
    case 'daily': {
      const daily = rc.dailyRate ?? 0;
      if (worked) {
        amountBase = daily;
        lines.push(line('gunluk_bedel', 'Gunluk goturu bedel', 1, 'gun', daily));
      }
      if (overtimeHours > 0 && rc.hourlyRate) {
        const rate = rc.hourlyRate * (rc.overtimeMultiplier ?? 1.5);
        amountOvertime = round2(overtimeHours * rate);
        lines.push(line('mesai', 'Mesai (gunluk bedel disi)', overtimeHours, 'saat', rate));
      }
      break;
    }
    case 'monthly': {
      const perDay = rc.monthlyRate
        ? round2(rc.monthlyRate / (rc.workingDaysPerMonth ?? 26))
        : (rc.dailyRate ?? 0);
      if (worked) {
        amountBase = perDay;
        lines.push(line('aylik_kira_prorata', 'Aylik kira - gunluk pay', 1, 'gun', perDay));
      }
      break;
    }
    case 'hourly':
    case 'hourly_with_min':
    default: {
      const rate = rc.hourlyRate ?? 0;
      amountBase = round2(normalHours * rate);
      if (normalHours > 0) {
        lines.push(line('calisma_saati', 'Calisma saati', normalHours, 'saat', rate));
      }
      if (minimumApplied > 0) {
        lines.push(line('asgari_saat_farki', `Gunluk asgari ${minHours} saat farki`, minimumApplied, 'saat', rate));
      }
      if (overtimeHours > 0) {
        const otRate = round2(rate * (rc.overtimeMultiplier ?? 1.5));
        amountOvertime = round2(overtimeHours * otRate);
        lines.push(line('mesai', `Mesai (${overtimeAfter} saat ustu)`, overtimeHours, 'saat', otRate));
      }
      break;
    }
  }

  // 5) Rolanti ayri tarifeleniyorsa.
  let amountIdle = 0;
  if (!rc.idleBillable && rc.idleHourlyRate && idleHours > 0) {
    amountIdle = round2(idleHours * rc.idleHourlyRate);
    lines.push(line('rolanti', 'Rolanti (dusuk tarife)', idleHours, 'saat', rc.idleHourlyRate));
  }

  // 6) Nakliye / mobilizasyon.
  let amountTransport = 0;
  if (worked && rc.transportFee) {
    amountTransport = round2(rc.transportFee);
    lines.push(line('nakliye', 'Nakliye / mobilizasyon', 1, 'gun', amountTransport));
  }

  // 7) Yakit musteriye yansitiliyorsa.
  const fuelUsedLiters = round2(input.fuelUsedLiters ?? 0);
  let amountFuel = 0;
  if (!rc.fuelIncluded && rc.fuelPricePerLiter && fuelUsedLiters > 0) {
    amountFuel = round2(fuelUsedLiters * rc.fuelPricePerLiter);
    lines.push(line('yakit', 'Yakit tuketimi', fuelUsedLiters, 'litre', rc.fuelPricePerLiter));
  }

  const amountNet = round2(amountBase + amountOvertime + amountIdle + amountTransport + amountFuel);
  const amountVat = round2(amountNet * (rc.vatRate ?? 0));
  const amountTotal = round2(amountNet + amountVat);

  return {
    assetId: input.assetId,
    dateKey: input.dateKey,
    rateCardId: rc.id,
    currency: rc.currency,
    engineHours,
    workingHours,
    idleHours,
    billableHours: Math.round(billableHours * 100) / 100,
    normalHours: Math.round(normalHours * 100) / 100,
    overtimeHours,
    amountBase,
    amountOvertime,
    amountIdle,
    amountTransport,
    amountFuel,
    amountNet,
    amountVat,
    amountTotal,
    fuelUsedLiters,
    lines,
  };
}

/** Oturumlari gunluk hakedis girdisine cevirir (tek gun icinde olduklari varsayilir). */
export function segmentsFromSessions(
  sessions: readonly WorkSession[],
): Array<{ durationSec: number; idleSec: number; workingSec: number }> {
  return sessions.map((s) => ({
    durationSec: s.durationSec,
    idleSec: s.idleSec,
    workingSec: s.workingSec,
  }));
}

export interface PeriodSummary {
  currency: string;
  days: number;
  workedDays: number;
  engineHours: number;
  workingHours: number;
  idleHours: number;
  billableHours: number;
  overtimeHours: number;
  fuelUsedLiters: number;
  amountNet: number;
  amountVat: number;
  amountTotal: number;
}

/** Donem (ay) icmali - hakedis raporu basligi. */
export function summarizePeriod(dailies: readonly DailyBilling[]): PeriodSummary {
  const currency = dailies[0]?.currency ?? 'TRY';
  return {
    currency,
    days: dailies.length,
    workedDays: dailies.filter((d) => d.engineHours > 0).length,
    engineHours: round2(sum(dailies.map((d) => d.engineHours))),
    workingHours: round2(sum(dailies.map((d) => d.workingHours))),
    idleHours: round2(sum(dailies.map((d) => d.idleHours))),
    billableHours: round2(sum(dailies.map((d) => d.billableHours))),
    overtimeHours: round2(sum(dailies.map((d) => d.overtimeHours))),
    fuelUsedLiters: round2(sum(dailies.map((d) => d.fuelUsedLiters))),
    amountNet: round2(sum(dailies.map((d) => d.amountNet))),
    amountVat: round2(sum(dailies.map((d) => d.amountVat))),
    amountTotal: round2(sum(dailies.map((d) => d.amountTotal))),
  };
}

/** Saat yuvarlama. Varsayilan: yuvarlama yok. */
export function roundHours(hours: number, stepHours?: number, mode: 'up' | 'nearest' | 'down' = 'up'): number {
  if (!stepHours || stepHours <= 0) return Math.round(hours * 100) / 100;
  const units = hours / stepHours;
  const rounded = mode === 'up' ? Math.ceil(units) : mode === 'down' ? Math.floor(units) : Math.round(units);
  return Math.round(rounded * stepHours * 100) / 100;
}

function line(code: string, label: string, quantity: number, unit: string, unitPrice: number): BillingLine {
  return {
    code,
    label,
    quantity: Math.round(quantity * 100) / 100,
    unit,
    unitPrice: round2(unitPrice),
    amount: round2(quantity * unitPrice),
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
