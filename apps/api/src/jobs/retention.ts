/**
 * Saklama ve imha isi (KVKK m.7 ve Saklama ve Imha Politikasi).
 *
 * "Islendikleri amac icin gerekli olan sure kadar muhafaza" ilkesinin
 * isletimsel karsiligi: suresi dolan kayitlar otomatik silinir veya
 * anonimlestirilir. Hukuki surec devam eden kayitlar (legal_hold) korunur.
 *
 * Her calisma retention_policies tablosuna islenir; boylece "imha
 * yukumlulugu yerine getirildi mi" sorusu belgelenebilir.
 */

import { unlink } from 'node:fs/promises';
import { DEFAULT_RETENTION_DAYS } from '@medentry/domain';
import { query, queryOne } from '../db/pool.js';

export interface RetentionOutcome {
  companyId: string;
  dataType: string;
  retentionDays: number;
  action: string;
  affected: number;
}

interface PolicyRow extends Record<string, unknown> {
  data_type: string;
  retention_days: number;
  action: string;
}

/** Sirket icin etkin politika listesi (tanimli olmayanlar varsayilandan gelir). */
async function effectivePolicies(companyId: string): Promise<PolicyRow[]> {
  const rows = await query<PolicyRow>(
    `SELECT data_type, retention_days, action
       FROM retention_policies WHERE company_id = $1 AND is_active`,
    [companyId],
  );
  const defined = new Set(rows.map((r) => r.data_type));
  const defaults: PolicyRow[] = Object.entries(DEFAULT_RETENTION_DAYS)
    .filter(([dataType]) => !defined.has(dataType))
    .map(([dataType, days]) => ({ data_type: dataType, retention_days: days, action: 'delete' }));
  return [...rows, ...defaults];
}

export async function runRetention(): Promise<RetentionOutcome[]> {
  const companies = await query<{ id: string }>(`SELECT id FROM companies`);
  const outcomes: RetentionOutcome[] = [];

  for (const company of companies) {
    for (const policy of await effectivePolicies(company.id)) {
      const affected = await applyPolicy(company.id, policy);
      outcomes.push({
        companyId: company.id,
        dataType: policy.data_type,
        retentionDays: policy.retention_days,
        action: policy.action,
        affected,
      });
      await query(
        `INSERT INTO retention_policies (company_id, data_type, retention_days, action, last_run_at, last_run_deleted)
         VALUES ($1,$2,$3,$4,now(),$5)
         ON CONFLICT (company_id, data_type) DO UPDATE
            SET last_run_at = now(), last_run_deleted = EXCLUDED.last_run_deleted`,
        [company.id, policy.data_type, policy.retention_days, policy.action, affected],
      );
    }
  }
  return outcomes;
}

async function applyPolicy(companyId: string, policy: PolicyRow): Promise<number> {
  const cutoff = new Date(Date.now() - policy.retention_days * 86_400_000);

  switch (policy.data_type) {
    case 'camera_recording':
    case 'camera_event_clip':
    case 'cabin_event_clip':
      return purgeRecordings(companyId, cutoff);

    case 'position':
      // Konum gecmisi silinirken calisma oturumlari korunur: hakedis ve is
      // hukuku ispati icin sure bilgisi daha uzun saklanir, ham iz silinir.
      return countAffected(
        await query<{ id: number }>(
          `DELETE FROM positions WHERE company_id = $1 AND ts < $2 RETURNING id`,
          [companyId, cutoff],
        ),
      );

    case 'work_session':
      if (policy.action === 'anonymize') {
        // Sureyi koru, kisiyi kopar.
        return countAffected(
          await query<{ id: string }>(
            `UPDATE work_sessions SET operator_id = NULL
              WHERE company_id = $1 AND started_at < $2 AND operator_id IS NOT NULL
              RETURNING id`,
            [companyId, cutoff],
          ),
        );
      }
      return countAffected(
        await query<{ id: string }>(
          `DELETE FROM work_sessions WHERE company_id = $1 AND started_at < $2 RETURNING id`,
          [companyId, cutoff],
        ),
      );

    case 'audit_log':
      return countAffected(
        await query<{ id: number }>(
          `DELETE FROM data_access_log WHERE company_id = $1 AND ts < $2 RETURNING id`,
          [companyId, cutoff],
        ),
      );

    case 'fuel_event':
      return countAffected(
        await query<{ id: number }>(
          `DELETE FROM fuel_events WHERE company_id = $1 AND ts < $2 RETURNING id`,
          [companyId, cutoff],
        ),
      );

    case 'device_event':
      return countAffected(
        await query<{ id: number }>(
          `DELETE FROM device_events WHERE company_id = $1 AND ts < $2 RETURNING id`,
          [companyId, cutoff],
        ),
      );

    case 'billing':
      // Mali kayitlar VUK/TTK geregi saklanir; bu politika yalnizca sureyi
      // belgelemek icindir, otomatik silme yapilmaz.
      return 0;

    default:
      return 0;
  }
}

/** Kamera kayitlarini siler; dosyayi diskten de kaldirir. */
async function purgeRecordings(companyId: string, cutoff: Date): Promise<number> {
  const rows = await query<{ id: string; storage_path: string | null }>(
    `SELECT id, storage_path FROM recordings
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND NOT legal_hold
        AND retention_until < now()
        AND started_at < $2`,
    [companyId, new Date(Math.max(cutoff.getTime(), 0))],
  );

  for (const row of rows) {
    if (row.storage_path) {
      try {
        await unlink(row.storage_path);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // Dosya zaten yoksa sorun degil; diger hatalar kayda dusulur.
        if (code !== 'ENOENT') {
          console.error('[retention] dosya silinemedi', row.storage_path, error);
          continue;
        }
      }
    }
    await query(`UPDATE recordings SET deleted_at = now(), storage_path = NULL WHERE id = $1`, [row.id]);
  }
  return rows.length;
}

function countAffected(rows: readonly unknown[]): number {
  return rows.length;
}

/**
 * Yaklasan imha ve gecikmis ilgili kisi basvurulari icin KVKK irtibat
 * kisisine ozet cikarir.
 */
export async function retentionSummary(companyId: string): Promise<{
  recordingsPendingDeletion: number;
  recordingsOnLegalHold: number;
  overdueDsrRequests: number;
  oldestPositionDays: number | null;
}> {
  const row = await queryOne<{
    pending: number;
    hold: number;
    overdue: number;
    oldest_days: number | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM recordings
         WHERE company_id = $1 AND deleted_at IS NULL AND NOT legal_hold AND retention_until < now()) AS pending,
       (SELECT COUNT(*) FROM recordings WHERE company_id = $1 AND legal_hold AND deleted_at IS NULL) AS hold,
       (SELECT COUNT(*) FROM dsr_requests
         WHERE company_id = $1 AND status IN ('received','in_progress') AND due_at < now()) AS overdue,
       (SELECT EXTRACT(DAY FROM now() - MIN(ts)) FROM positions WHERE company_id = $1) AS oldest_days`,
    [companyId],
  );

  return {
    recordingsPendingDeletion: Number(row?.pending ?? 0),
    recordingsOnLegalHold: Number(row?.hold ?? 0),
    overdueDsrRequests: Number(row?.overdue ?? 0),
    oldestPositionDays: row?.oldest_days != null ? Number(row.oldest_days) : null,
  };
}
