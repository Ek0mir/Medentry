/**
 * KVKK erisim denetimi - API tarafi.
 *
 * Domain katmanindaki saf politika motorunu (evaluateAccess) veritabanindaki
 * gercek verilerle besler:
 *   - varliga/sirkete tanimli mahremiyet pencereleri
 *   - ilgili operatorun aydinlatma metnini teyit edip etmedigi
 *   - erisim aninda vardiyada operator olup olmadigi
 * Sonucu her durumda data_access_log'a yazar (izin verilen ve reddedilen).
 */

import { evaluateAccess } from '@medentry/domain';
import type { AccessDecision, DataType } from '@medentry/domain';
import type { CameraPosition, PrivacyWindow, ProcessingPurpose } from '@medentry/shared';
import { PURPOSE_CATALOG } from '@medentry/shared';
import { HttpError } from '../auth/context.js';
import type { AuthUser } from '../auth/context.js';
import { query, queryOne } from '../db/pool.js';

export interface GuardParams {
  user: AuthUser;
  purpose: string;
  dataType: DataType;
  action: string;
  assetId?: string;
  cameraPosition?: CameraPosition;
  reason?: string;
  linkedEventId?: string | number;
  /** Erisimin konusu olan operator (bildirim ve denetim icin). */
  subjectUserId?: string;
  ts?: Date;
  ip?: string;
  userAgent?: string;
  /**
   * Sik tekrarlanan okumalarda (or. arayuzun 15 saniyede bir yenilenen
   * durum ekrani) denetim kaydini sinirlar. Politika her cagride tam olarak
   * degerlendirilir; yalnizca AYNI kullanicinin AYNI islemi icin tekrar eden
   * IZIN kayitlari birlestirilir. Reddedilen erisimler her zaman yazilir.
   */
  auditThrottleMs?: number;
}

const lastAudit = new Map<string, number>();

function shouldSkipAudit(key: string, throttleMs?: number): boolean {
  if (!throttleMs) return false;
  const now = Date.now();
  const previous = lastAudit.get(key);
  if (previous !== undefined && now - previous < throttleMs) return true;
  lastAudit.set(key, now);
  // Bellekte sinirsiz buyumeyi engelle.
  if (lastAudit.size > 10_000) {
    for (const [k, v] of lastAudit) {
      if (now - v > 3600_000) lastAudit.delete(k);
    }
  }
  return false;
}

const SETTINGS_TTL_MS = 60_000;
const companySettings = new Map<string, { soloMode: boolean; expires: number }>();

/** Sirket tek kullanici modunda mi? (60 sn onbellekli) */
export async function isSoloCompany(companyId: string): Promise<boolean> {
  const cached = companySettings.get(companyId);
  if (cached && cached.expires > Date.now()) return cached.soloMode;

  const row = await queryOne<{ solo_mode: boolean }>(
    `SELECT solo_mode FROM companies WHERE id = $1`,
    [companyId],
  );
  const soloMode = row?.solo_mode === true;
  companySettings.set(companyId, { soloMode, expires: Date.now() + SETTINGS_TTL_MS });
  return soloMode;
}

/** Ayar degistiginde onbellegi bosaltir. */
export function clearCompanySettingsCache(): void {
  companySettings.clear();
}

export interface GuardResult {
  decision: AccessDecision;
  /** Bildirim gonderilecek ilgili kisi. Kullanicinin kendisiyse bos birakilir. */
  subjectUserId?: string;
  auditId?: number;
  /** Karar tek kullanici modunda mi verildi? */
  soloMode: boolean;
}

function assertPurpose(value: string): ProcessingPurpose {
  if (!(value in PURPOSE_CATALOG)) {
    throw new HttpError(400, `Gecersiz isleme amaci: ${value}`, 'INVALID_PURPOSE', {
      allowed: Object.keys(PURPOSE_CATALOG),
    });
  }
  return value as ProcessingPurpose;
}

/** Sirket ve varlik duzeyindeki mahremiyet pencerelerini yukler. */
export async function loadPrivacyWindows(companyId: string, assetId?: string): Promise<PrivacyWindow[]> {
  const rows = await query<{
    id: string;
    asset_id: string | null;
    kind: string;
    weekdays: number[] | null;
    start_time: string | null;
    end_time: string | null;
    starts_at: Date | null;
    ends_at: Date | null;
    is_active: boolean;
  }>(
    `SELECT id, asset_id, kind, weekdays, start_time::text, end_time::text, starts_at, ends_at, is_active
       FROM privacy_windows
      WHERE company_id = $1
        AND is_active
        AND (asset_id IS NULL OR asset_id = $2)`,
    [companyId, assetId ?? null],
  );

  return rows.map((row) => {
    const window: PrivacyWindow = {
      id: row.id,
      assetId: row.asset_id,
      kind: row.kind as PrivacyWindow['kind'],
      active: row.is_active,
    };
    if (row.weekdays && row.weekdays.length > 0) window.weekdays = row.weekdays;
    // time alani "12:00:00" doner; politika motoru "HH:MM" bekler.
    if (row.start_time) window.startTime = row.start_time.slice(0, 5);
    if (row.end_time) window.endTime = row.end_time.slice(0, 5);
    if (row.starts_at) window.startsAt = new Date(row.starts_at);
    if (row.ends_at) window.endsAt = new Date(row.ends_at);
    return window;
  });
}

/** Verilen an icin varliga atanmis operatoru dondurur. */
export async function activeOperator(
  assetId: string,
  ts: Date,
): Promise<{ id: string; full_name: string } | null> {
  return queryOne<{ id: string; full_name: string }>(
    `SELECT u.id, u.full_name
       FROM operator_assignments a
       JOIN users u ON u.id = a.operator_id
      WHERE a.asset_id = $1
        AND a.starts_at <= $2
        AND (a.ends_at IS NULL OR a.ends_at > $2)
      ORDER BY a.starts_at DESC
      LIMIT 1`,
    [assetId, ts],
  );
}

/**
 * Operator kamera aydinlatma metnini teyit etti mi?
 * Teyit yoksa kamera erisimi acilmaz (gizli izleme yasagi).
 */
export async function hasAcknowledgedNotice(userId: string, kind = 'camera'): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT true AS ok
       FROM notice_acknowledgements ack
       JOIN privacy_notices n ON n.id = ack.notice_id
      WHERE ack.user_id = $1
        AND n.kind = $2
        AND ack.granted
        AND ack.withdrawn_at IS NULL
        AND n.published_at IS NOT NULL
      LIMIT 1`,
    [userId, kind],
  );
  return row?.ok === true;
}

/**
 * Erisimi degerlendirir, denetim kaydini yazar ve reddedildiyse 403 firlatir.
 */
export async function guardAccess(params: GuardParams): Promise<GuardResult> {
  const purpose = assertPurpose(params.purpose);
  const ts = params.ts ?? new Date();
  const isCamera =
    params.dataType === 'camera_live' ||
    params.dataType === 'camera_playback' ||
    params.dataType === 'recording_download';

  const privacyWindows = params.assetId
    ? await loadPrivacyWindows(params.user.companyId, params.assetId)
    : await loadPrivacyWindows(params.user.companyId);

  let subjectUserId = params.subjectUserId;
  let operatorOnShift: boolean | undefined;
  if (params.assetId) {
    const operator = await activeOperator(params.assetId, ts);
    operatorOnShift = operator !== null;
    if (!subjectUserId && operator) subjectUserId = operator.id;
  }

  // Tek kullanici modu, yalnizca izlenen kisi istegi yapan kullanicinin
  // kendisiyse (veya makineye hic operator atanmamissa) devreye girer.
  // Makineye baska biri atandigi anda calisan korumalari kendiliginden doner.
  const soloMode =
    (await isSoloCompany(params.user.companyId)) &&
    (subjectUserId === undefined || subjectUserId === params.user.id);

  // Aydinlatma teyidi yalnizca kamera erisiminde ve bir ilgili kisi
  // belirlenebiliyorsa aranir.
  let operatorAcknowledged: boolean | undefined;
  if (isCamera && subjectUserId && !soloMode) {
    operatorAcknowledged = await hasAcknowledgedNotice(subjectUserId, 'camera');
  }

  const decision = evaluateAccess({
    role: params.user.role,
    purpose,
    dataType: params.dataType,
    ts,
    assetId: params.assetId,
    cameraPosition: params.cameraPosition,
    reason: params.reason,
    linkedEventId: params.linkedEventId !== undefined ? String(params.linkedEventId) : undefined,
    operatorAcknowledged,
    operatorOnShift,
    privacyWindows,
    soloMode,
  });

  const throttleKey = `${params.user.id}|${params.action}|${params.assetId ?? '-'}`;
  const skipAudit = decision.allowed && shouldSkipAudit(throttleKey, params.auditThrottleMs);
  const auditId = skipAudit
    ? undefined
    : await writeAuditLog({
        companyId: params.user.companyId,
        userId: params.user.id,
        action: params.action,
        dataType: params.dataType,
        purpose,
        reason: params.reason,
        assetId: params.assetId,
        subjectUserId,
        decision,
        ip: params.ip,
        userAgent: params.userAgent,
        ts,
      });

  if (!decision.allowed) {
    throw new HttpError(403, decision.message, decision.code, {
      purpose,
      dataType: params.dataType,
      auditId,
    });
  }

  const result: GuardResult = { decision, soloMode };
  // Kisi kendi verisine bakiyorsa kendine bildirim gonderilmez.
  if (subjectUserId && subjectUserId !== params.user.id) result.subjectUserId = subjectUserId;
  if (auditId !== undefined) result.auditId = auditId;
  return result;
}

export interface AuditInput {
  companyId: string;
  userId?: string;
  action: string;
  dataType: string;
  purpose: string;
  reason?: string;
  assetId?: string;
  subjectUserId?: string;
  decision: AccessDecision;
  ip?: string;
  userAgent?: string;
  ts?: Date;
}

export async function writeAuditLog(input: AuditInput): Promise<number | undefined> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO data_access_log
       (company_id, user_id, ts, action, data_type, purpose, reason, asset_id,
        subject_user_id, result, decision_code, obligations, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      input.companyId,
      input.userId ?? null,
      input.ts ?? new Date(),
      input.action,
      input.dataType,
      input.purpose,
      input.reason ?? null,
      input.assetId ?? null,
      input.subjectUserId ?? null,
      input.decision.allowed ? 'allow' : 'deny',
      input.decision.code,
      input.decision.obligations,
      input.ip ?? null,
      input.userAgent ?? null,
    ],
  );
  return row?.id;
}

/**
 * Seffaflik yukumlulugu: operatorun goruntusune erisildiginde kendisine
 * bildirim birakilir. "Gizli kamera yok" ilkesinin isletimsel karsiligi.
 */
export async function notifyOperatorOfAccess(params: {
  companyId: string;
  operatorId: string;
  assetName: string;
  viewerName: string;
  purpose: ProcessingPurpose;
  reason: string;
  mode: 'live' | 'playback';
}): Promise<void> {
  const purposeLabel = PURPOSE_CATALOG[params.purpose]?.label ?? params.purpose;
  await query(
    `INSERT INTO notifications (company_id, user_id, kind, title, body, payload)
     VALUES ($1, $2, 'camera_access', $3, $4, $5)`,
    [
      params.companyId,
      params.operatorId,
      params.mode === 'live' ? 'Kamera goruntunuz izlendi' : 'Kamera kaydiniz goruntulendi',
      `${params.assetName} aracinin kamerasi ${params.viewerName} tarafindan "${purposeLabel}" amaciyla goruntulendi. ` +
        `Gerekce: ${params.reason}. Itiraz ve bilgi talepleriniz icin KVKK irtibat kisisine basvurabilirsiniz.`,
      JSON.stringify({ purpose: params.purpose, mode: params.mode }),
    ],
  );
}
