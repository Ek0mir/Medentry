/**
 * Hakedis uclari.
 *
 * Hakedis, telemetriden otomatik uretilir ama santiye sefi/yonetici onayina
 * tabidir. Onaylanan gun kilitlenir: sonradan gelen telemetri onaylanmis
 * tutari degistiremez (itiraza acik bir hesabin sonradan degismemesi gerekir).
 */

import type { FastifyInstance } from 'fastify';
import { summarizePeriod } from '@medentry/domain';
import type { DailyBilling } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requireRole, requestMeta } from '../auth/context.js';
import { query, queryOne } from '../db/pool.js';
import { detectFuelForDay, recomputeDailyBilling } from '../jobs/rollup.js';
import { guardAccess } from '../kvkk/guard.js';
import { dateKey as parseDateKey, num, optionalStr, str, uuid } from './validate.js';

interface BillingRow {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  project_name: string | null;
  work_date: string;
  currency: string;
  engine_hours: number;
  working_hours: number;
  idle_hours: number;
  billable_hours: number;
  normal_hours: number;
  overtime_hours: number;
  fuel_used_liters: number;
  amount_base: number;
  amount_overtime: number;
  amount_idle: number;
  amount_transport: number;
  amount_fuel: number;
  amount_net: number;
  amount_vat: number;
  amount_total: number;
  status: string;
  lines: unknown;
  approved_by_name: string | null;
  approved_at: Date | null;
  manual_adjust_hours: number | null;
  manual_adjust_note: string | null;
}

const BILLING_SELECT = `
  SELECT b.id, b.asset_id, a.code AS asset_code, a.name AS asset_name, p.name AS project_name,
         to_char(b.work_date, 'YYYY-MM-DD') AS work_date, b.currency,
         b.engine_hours, b.working_hours, b.idle_hours, b.billable_hours,
         b.normal_hours, b.overtime_hours, b.fuel_used_liters,
         b.amount_base, b.amount_overtime, b.amount_idle, b.amount_transport, b.amount_fuel,
         b.amount_net, b.amount_vat, b.amount_total, b.status, b.lines,
         b.manual_adjust_hours, b.manual_adjust_note,
         u.full_name AS approved_by_name, b.approved_at
    FROM daily_billing b
    JOIN assets a ON a.id = b.asset_id
    LEFT JOIN projects p ON p.id = b.project_id
    LEFT JOIN users u ON u.id = b.approved_by
`;

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /** Gunluk hakedis listesi. */
  app.get('/api/billing', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;
    const from = parseDateKey(q['from'] ?? defaultFrom(), 'from');
    const to = parseDateKey(q['to'] ?? defaultTo(), 'to');
    const assetId = q['assetId'] ? uuid(q['assetId'], 'assetId') : null;

    await guardAccess({
      user,
      purpose: 'hakedis_faturalama',
      dataType: 'billing',
      action: 'billing_list',
      assetId: assetId ?? undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
      auditThrottleMs: 15 * 60_000,
    });

    const rows = await query<BillingRow>(
      `${BILLING_SELECT}
       WHERE b.company_id = $1 AND b.work_date BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR b.asset_id = $4)
       ORDER BY b.work_date DESC, a.code`,
      [user.companyId, from, to, assetId],
    );

    return { from, to, rows: rows.map(toBillingDto) };
  });

  /** Donem icmali (varlik bazinda toplam). */
  app.get('/api/billing/summary', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;
    const from = parseDateKey(q['from'] ?? defaultFrom(), 'from');
    const to = parseDateKey(q['to'] ?? defaultTo(), 'to');

    await guardAccess({
      user,
      purpose: 'hakedis_faturalama',
      dataType: 'billing',
      action: 'billing_summary',
      ip: meta.ip,
      userAgent: meta.userAgent,
      auditThrottleMs: 15 * 60_000,
    });

    const rows = await query<BillingRow>(
      `${BILLING_SELECT}
       WHERE b.company_id = $1 AND b.work_date BETWEEN $2 AND $3
       ORDER BY a.code, b.work_date`,
      [user.companyId, from, to],
    );

    const byAsset = new Map<string, BillingRow[]>();
    for (const row of rows) {
      const list = byAsset.get(row.asset_id) ?? [];
      list.push(row);
      byAsset.set(row.asset_id, list);
    }

    const assets = [...byAsset.entries()].map(([assetId, list]) => {
      const first = list[0]!;
      const summary = summarizePeriod(list.map(toDomainBilling));
      return {
        assetId,
        code: first.asset_code,
        name: first.asset_name,
        project: first.project_name,
        ...summary,
        approvedDays: list.filter((r) => r.status !== 'draft').length,
      };
    });

    return {
      from,
      to,
      assets,
      total: {
        currency: assets[0]?.currency ?? 'TRY',
        billableHours: round2(assets.reduce((s, a) => s + a.billableHours, 0)),
        engineHours: round2(assets.reduce((s, a) => s + a.engineHours, 0)),
        idleHours: round2(assets.reduce((s, a) => s + a.idleHours, 0)),
        fuelUsedLiters: round2(assets.reduce((s, a) => s + a.fuelUsedLiters, 0)),
        amountNet: round2(assets.reduce((s, a) => s + a.amountNet, 0)),
        amountVat: round2(assets.reduce((s, a) => s + a.amountVat, 0)),
        amountTotal: round2(assets.reduce((s, a) => s + a.amountTotal, 0)),
      },
    };
  });

  /** Hakedis CSV disari aktarimi (muhasebe icin). */
  app.get('/api/billing/export.csv', { preHandler: requireRole('owner', 'manager', 'dpo') }, async (request, reply) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;
    const from = parseDateKey(q['from'] ?? defaultFrom(), 'from');
    const to = parseDateKey(q['to'] ?? defaultTo(), 'to');

    await guardAccess({
      user,
      purpose: 'hakedis_faturalama',
      dataType: 'export',
      action: 'billing_export',
      reason: `Hakedis disari aktarimi ${from} - ${to}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const rows = await query<BillingRow>(
      `${BILLING_SELECT}
       WHERE b.company_id = $1 AND b.work_date BETWEEN $2 AND $3
       ORDER BY b.work_date, a.code`,
      [user.companyId, from, to],
    );

    const header = [
      'Tarih',
      'Makine Kodu',
      'Makine',
      'Proje',
      'Motor Saati',
      'Calisma Saati',
      'Rolanti Saati',
      'Faturalanabilir Saat',
      'Mesai Saati',
      'Yakit (lt)',
      'Tutar (KDV Haric)',
      'KDV',
      'Toplam',
      'Para Birimi',
      'Durum',
    ];
    const lines = [header.join(';')];
    for (const row of rows) {
      lines.push(
        [
          row.work_date,
          row.asset_code,
          row.asset_name,
          row.project_name ?? '',
          fmt(row.engine_hours),
          fmt(row.working_hours),
          fmt(row.idle_hours),
          fmt(row.billable_hours),
          fmt(row.overtime_hours),
          fmt(row.fuel_used_liters),
          fmt(row.amount_net),
          fmt(row.amount_vat),
          fmt(row.amount_total),
          row.currency,
          row.status,
        ]
          .map(csvCell)
          .join(';'),
      );
    }

    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="hakedis-${from}_${to}.csv"`)
      // Excel'in UTF-8 algilamasi icin BOM.
      .send('﻿' + lines.join('\n'));
  });

  /** Gunu yeniden hesapla (taslak gunler icin). */
  app.post('/api/billing/recompute', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const body = request.body as Record<string, unknown>;
    const assetId = uuid(body['assetId'], 'assetId');
    const date = parseDateKey(body['date'], 'date');

    const user = currentUser(request);
    await assertAssetInCompany(assetId, user.companyId);

    // Yeniden hesap, gunun tamamini kapsar: once yakit olaylari tespit edilir,
    // sonra hakedis bu veriyle uretilir.
    await detectFuelForDay(assetId, date);
    const updated = await recomputeDailyBilling(assetId, date);
    if (!updated) {
      throw new HttpError(409, 'Onaylanmis gun yeniden hesaplanamaz', 'BILLING_LOCKED');
    }
    return { ok: true };
  });

  /** Elle saat duzeltmesi (gerekce zorunlu). */
  app.post('/api/billing/:id/adjust', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');
    const body = request.body as Record<string, unknown>;
    const hours = num(body, 'hours', { min: -24, max: 24 });
    const note = str(body, 'note', { min: 10, max: 500 });

    const row = await queryOne<{ asset_id: string; work_date: string; status: string }>(
      `SELECT asset_id, to_char(work_date,'YYYY-MM-DD') AS work_date, status
         FROM daily_billing WHERE id = $1 AND company_id = $2`,
      [id, user.companyId],
    );
    if (!row) throw new HttpError(404, 'Hakedis kaydi bulunamadi');
    if (row.status !== 'draft') throw new HttpError(409, 'Onaylanmis hakedis degistirilemez', 'BILLING_LOCKED');

    await query(`UPDATE daily_billing SET manual_adjust_hours = $2, manual_adjust_note = $3 WHERE id = $1`, [
      id,
      hours,
      `${note} (${user.name})`,
    ]);
    await recomputeDailyBilling(row.asset_id, row.work_date);

    return { ok: true };
  });

  /** Hakedis onayi - onay sonrasi gun kilitlenir. */
  app.post('/api/billing/:id/approve', { preHandler: requireRole('owner', 'manager', 'site_chief') }, async (request) => {
    const user = currentUser(request);
    const id = uuid((request.params as Record<string, unknown>)['id'], 'id');

    const rows = await query<{ id: string }>(
      `UPDATE daily_billing
          SET status = 'approved', approved_by = $3, approved_at = now()
        WHERE id = $1 AND company_id = $2 AND status = 'draft'
        RETURNING id`,
      [id, user.companyId, user.id],
    );
    if (rows.length === 0) {
      throw new HttpError(409, 'Kayit bulunamadi veya zaten onaylanmis', 'BILLING_ALREADY_APPROVED');
    }
    return { ok: true };
  });

  /** Toplu onay: bir gun icin tum taslaklar. */
  app.post('/api/billing/approve-day', { preHandler: requireRole('owner', 'manager') }, async (request) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const date = parseDateKey(body['date'], 'date');
    const projectId = optionalStr(body, 'projectId');

    const rows = await query<{ id: string }>(
      `UPDATE daily_billing
          SET status = 'approved', approved_by = $3, approved_at = now()
        WHERE company_id = $1 AND work_date = $2 AND status = 'draft'
          AND ($4::uuid IS NULL OR project_id = $4)
        RETURNING id`,
      [user.companyId, date, user.id, projectId ?? null],
    );
    return { approved: rows.length };
  });
}

async function assertAssetInCompany(assetId: string, companyId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM assets WHERE id = $1 AND company_id = $2`, [
    assetId,
    companyId,
  ]);
  if (!row) throw new HttpError(404, 'Varlik bulunamadi');
}

function toBillingDto(row: BillingRow) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    project: row.project_name,
    date: row.work_date,
    currency: row.currency,
    engineHours: row.engine_hours,
    workingHours: row.working_hours,
    idleHours: row.idle_hours,
    billableHours: row.billable_hours,
    normalHours: row.normal_hours,
    overtimeHours: row.overtime_hours,
    fuelUsedLiters: row.fuel_used_liters,
    amountBase: row.amount_base,
    amountOvertime: row.amount_overtime,
    amountIdle: row.amount_idle,
    amountTransport: row.amount_transport,
    amountFuel: row.amount_fuel,
    amountNet: row.amount_net,
    amountVat: row.amount_vat,
    amountTotal: row.amount_total,
    status: row.status,
    lines: row.lines,
    manualAdjustHours: row.manual_adjust_hours,
    manualAdjustNote: row.manual_adjust_note,
    approvedBy: row.approved_by_name,
    approvedAt: row.approved_at,
  };
}

function toDomainBilling(row: BillingRow): DailyBilling {
  return {
    assetId: row.asset_id,
    dateKey: row.work_date,
    rateCardId: '',
    currency: row.currency,
    engineHours: row.engine_hours,
    workingHours: row.working_hours,
    idleHours: row.idle_hours,
    billableHours: row.billable_hours,
    normalHours: row.normal_hours,
    overtimeHours: row.overtime_hours,
    amountBase: row.amount_base,
    amountOvertime: row.amount_overtime,
    amountIdle: row.amount_idle,
    amountTransport: row.amount_transport,
    amountFuel: row.amount_fuel,
    amountNet: row.amount_net,
    amountVat: row.amount_vat,
    amountTotal: row.amount_total,
    fuelUsedLiters: row.fuel_used_liters,
    lines: [],
  };
}

function defaultFrom(): string {
  const d = new Date(Date.now() - 29 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(value: number | null): string {
  // Turkce Excel ondalik ayraci virguldur.
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

function csvCell(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
