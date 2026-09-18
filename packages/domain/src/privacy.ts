/**
 * KVKK / is hukuku kurallarinin KOD SEVIYESINDE uygulanmasi.
 *
 * Bu dosyanin amaci, mahremiyet kurallarini "politika belgesi" olmaktan
 * cikarip calisan bir kisit haline getirmektir. Kamera ve konum verisine
 * her erisim buradan gecer; uygun olmayan erisim API'de reddedilir ve
 * denetim kaydina yazilir.
 *
 * Dayanak ilkeler (KVKK m.4):
 *  - Hukuka ve durustluk kurallarina uygunluk  -> gizli kamera YOK, operator
 *    bilgilendirilmeden isleme yok.
 *  - Belirli, acik ve mesru amaclar icin isleme -> her erisim bir amaca bagli.
 *  - Islendikleri amacla baglantili, sinirli ve olculu -> kabin kamerasi
 *    surekli izlemeye kapali, yalnizca olay bazli.
 *  - Ilgili mevzuatta ongorulen sure kadar muhafaza -> saklama sureleri.
 */

import { localIsoWeekday, minutesIntoLocalDay, DEFAULT_TIMEZONE } from '@medentry/shared';
import { PURPOSE_DATA_MATRIX } from '@medentry/shared';
import type {
  CameraPosition,
  PrivacyWindow,
  ProcessingPurpose,
  UserRole,
} from '@medentry/shared';

/** Erisim talebine konu veri turu. */
export type DataType =
  | 'position'
  | 'position_history'
  | 'session'
  | 'event'
  | 'fuel'
  | 'billing'
  | 'diagnostics'
  | 'camera_live'
  | 'camera_playback'
  | 'recording_download'
  | 'export';

export interface AccessRequest {
  role: UserRole;
  purpose: ProcessingPurpose;
  dataType: DataType;
  /** Erisimin yapildigi an. */
  ts: Date;
  assetId?: string;
  cameraPosition?: CameraPosition;
  /** Serbest metin gerekce - kamera erisimlerinde zorunlu. */
  reason?: string;
  /** Kamera erisimini gerekcelendiren olay kaydi (kaza, alarm vb.). */
  linkedEventId?: string;
  /** Ilgili operator aydinlatma metnini okuyup teyit etti mi? */
  operatorAcknowledged?: boolean;
  /** Erisim aninda vardiyada bir operator var mi? */
  operatorOnShift?: boolean;
  privacyWindows?: readonly PrivacyWindow[];
  timeZone?: string;
}

export interface AccessDecision {
  allowed: boolean;
  /** Makine okunur gerekce kodu (denetim kaydina yazilir). */
  code: string;
  /** Kullaniciya gosterilecek Turkce aciklama. */
  message: string;
  /**
   * Erisime eslik eden yukumlulukler; API bunlari uygular.
   * or. 'notify_operator' -> operatore bildirim gonderilir.
   */
  obligations: Obligation[];
}

export type Obligation =
  | 'audit_log' // her durumda
  | 'notify_operator' // operatore "goruntunuz izlendi" bildirimi
  | 'require_reason' // gerekce metni zorunlu
  | 'mask_privacy_zone' // mahremiyet bolgesinde konum maskelenir
  | 'coarse_location_only' // yalnizca sehir/ilce duzeyinde konum
  | 'event_window_only' // yalnizca olay aninin +/- penceresi
  | 'no_audio' // ses kaydi/dinleme kapali
  | 'dual_control'; // ikinci bir yetkilinin onayi

/** Kabin kamerasinin olay penceresi (saniye): olaydan once/sonra. */
export const EVENT_CLIP_BEFORE_SEC = 30;
export const EVENT_CLIP_AFTER_SEC = 30;

/** Kamera goruntusune canli erisim hakki olan roller. */
const CAMERA_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['owner', 'manager', 'site_chief', 'dpo']);

/** Veri disari aktarma (export) hakki olan roller. */
const EXPORT_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['owner', 'manager', 'dpo']);

/** Kabin kamerasina erisimi mesru kilan amaclar - baska amacla acilmaz. */
const CABIN_ALLOWED_PURPOSES: ReadonlySet<ProcessingPurpose> = new Set<ProcessingPurpose>([
  'kaza_inceleme',
  'is_guvenligi',
  'hukuki_talep',
]);

/** Vardiya disinda dis kameraya erisimi mesru kilan amaclar (hirsizlik). */
const OFF_SHIFT_ALLOWED_PURPOSES: ReadonlySet<ProcessingPurpose> = new Set<ProcessingPurpose>([
  'varlik_guvenligi',
  'hukuki_talep',
]);

const MIN_REASON_LENGTH = 15;

/** Veri turunun amac matrisindeki karsiligi. */
function matrixKey(dataType: DataType, cameraPosition?: CameraPosition): string {
  switch (dataType) {
    case 'position':
    case 'position_history':
      return 'position';
    case 'camera_live':
    case 'camera_playback':
      return cameraPosition === 'cabin' ? 'camera_cabin_event' : 'camera_outward';
    case 'recording_download':
      return 'recording';
    case 'export':
      return 'billing';
    default:
      return dataType;
  }
}

/**
 * Erisim talebini degerlendirir.
 * Sonuc ne olursa olsun cagiran taraf denetim kaydi yazmalidir.
 */
export function evaluateAccess(req: AccessRequest): AccessDecision {
  const obligations: Obligation[] = ['audit_log'];
  const isCamera =
    req.dataType === 'camera_live' ||
    req.dataType === 'camera_playback' ||
    req.dataType === 'recording_download';

  // 1) Amacla sinirlilik: bu amac bu veri turune erisebilir mi?
  const key = matrixKey(req.dataType, req.cameraPosition);
  const allowedKeys = PURPOSE_DATA_MATRIX[req.purpose] ?? [];
  if (!allowedKeys.includes(key)) {
    return deny(
      'PURPOSE_MISMATCH',
      `Secilen amac (${req.purpose}) bu veri turune erisim icin tanimli degil. Amacla sinirlilik ilkesi geregi erisim reddedildi.`,
    );
  }

  // 2) Rol kontrolu.
  if (isCamera && !CAMERA_ROLES.has(req.role)) {
    return deny('ROLE_FORBIDDEN', 'Rolunuz kamera goruntusune erisim icin yetkili degil.');
  }
  if (req.dataType === 'export' && !EXPORT_ROLES.has(req.role)) {
    return deny('ROLE_FORBIDDEN', 'Rolunuz veri disari aktarimi icin yetkili degil.');
  }
  if (req.role === 'operator' && isCamera) {
    return deny('ROLE_FORBIDDEN', 'Operator hesabi kamera goruntusu izleyemez.');
  }

  // 3) Aydinlatma yukumlulugu: operator bilgilendirilmeden kamera acilmaz.
  if (isCamera && req.operatorAcknowledged === false) {
    return deny(
      'NOTICE_NOT_ACKNOWLEDGED',
      'Ilgili operator kamera aydinlatma metnini teyit etmemis. Bilgilendirme tamamlanmadan goruntuye erisilemez.',
    );
  }

  // 4) Gerekce zorunlulugu.
  if (isCamera) {
    obligations.push('require_reason', 'notify_operator', 'no_audio');
    if (!req.reason || req.reason.trim().length < MIN_REASON_LENGTH) {
      return deny(
        'REASON_REQUIRED',
        `Kamera erisimi icin en az ${MIN_REASON_LENGTH} karakterlik gerekce girilmelidir.`,
      );
    }
  }

  // 5) Mahremiyet penceresi (mola / vardiya disi / ozel kullanim).
  const window = activePrivacyWindow(req.ts, req.privacyWindows ?? [], req.assetId, req.timeZone);
  if (window) {
    if (isCamera) {
      const offShiftException =
        window.kind === 'off_shift' &&
        req.cameraPosition !== 'cabin' &&
        OFF_SHIFT_ALLOWED_PURPOSES.has(req.purpose) &&
        req.operatorOnShift !== true;
      if (!offShiftException) {
        return deny(
          'PRIVACY_WINDOW',
          `Bu zaman araligi mahremiyet penceresi (${privacyWindowLabel(window.kind)}) olarak tanimli. Kamera erisimi kapalidir.`,
        );
      }
      obligations.push('dual_control');
    } else if (window.kind === 'private_use') {
      // Ozel kullanim: konum takibi yapilmaz, yalnizca kaba konum.
      obligations.push('coarse_location_only');
    }
  }

  // 6) Kabin kamerasi: surekli izleme YOK, yalnizca olay bazli.
  if (req.cameraPosition === 'cabin') {
    if (!CABIN_ALLOWED_PURPOSES.has(req.purpose)) {
      return deny(
        'CABIN_PURPOSE_FORBIDDEN',
        'Kabin ici kamera yalnizca is guvenligi olayi, kaza incelemesi veya hukuki talep kapsaminda goruntulenebilir.',
      );
    }
    if (req.dataType === 'camera_live') {
      return deny(
        'CABIN_LIVE_FORBIDDEN',
        'Kabin ici kameranin canli izlenmesi kapalidir. Yalnizca olaya bagli kayit parcasi izlenebilir.',
      );
    }
    if (!req.linkedEventId) {
      return deny(
        'CABIN_EVENT_REQUIRED',
        'Kabin ici goruntu icin bir olay kaydi (kaza, sert fren, alarm) referansi zorunludur.',
      );
    }
    obligations.push('event_window_only', 'dual_control');
  }

  // 7) Konum gecmisi her zaman mahremiyet bolgesi maskelemesine tabidir.
  if (req.dataType === 'position' || req.dataType === 'position_history') {
    obligations.push('mask_privacy_zone');
  }

  return {
    allowed: true,
    code: 'ALLOWED',
    message: 'Erisim izni verildi. Islem denetim kaydina yazildi.',
    obligations: unique(obligations),
  };
}

function deny(code: string, message: string): AccessDecision {
  return { allowed: false, code, message, obligations: ['audit_log'] };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function privacyWindowLabel(kind: PrivacyWindow['kind']): string {
  switch (kind) {
    case 'break':
      return 'mola';
    case 'off_shift':
      return 'vardiya disi';
    case 'private_use':
      return 'ozel kullanim';
    default:
      return kind;
  }
}

/**
 * Verilen an icin aktif mahremiyet penceresini dondurur.
 * Once varliga ozel pencereler, sonra genel pencereler degerlendirilir.
 */
export function activePrivacyWindow(
  ts: Date,
  windows: readonly PrivacyWindow[],
  assetId?: string,
  timeZone: string = DEFAULT_TIMEZONE,
): PrivacyWindow | null {
  const candidates = windows
    .filter((w) => w.active)
    .filter((w) => !w.assetId || w.assetId === assetId)
    // Varliga ozel pencere genel pencereden onceliklidir.
    .sort((a, b) => (a.assetId ? 0 : 1) - (b.assetId ? 0 : 1));

  for (const w of candidates) {
    if (w.startsAt && w.endsAt) {
      if (ts >= w.startsAt && ts < w.endsAt) return w;
      continue;
    }
    if (!w.startTime || !w.endTime) continue;
    if (w.weekdays && w.weekdays.length > 0) {
      const wd = localIsoWeekday(ts, timeZone);
      if (!w.weekdays.includes(wd)) continue;
    }
    const minutes = minutesIntoLocalDay(ts, timeZone);
    const start = parseHhMm(w.startTime);
    const end = parseHhMm(w.endTime);
    if (start === null || end === null) continue;
    // Gece yarisini asan pencere (or. 18:00 - 07:00).
    const inside = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inside) return w;
  }
  return null;
}

function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Konumu mahremiyet duzeyine gore maskeler.
 * `coarse` modda koordinat ~1.1 km hassasiyete yuvarlanir (2 ondalik).
 */
export function maskPosition(
  position: { lat: number; lon: number },
  mode: 'none' | 'coarse' | 'hidden',
): { lat: number; lon: number } | null {
  if (mode === 'hidden') return null;
  if (mode === 'none') return position;
  return {
    lat: Math.round(position.lat * 100) / 100,
    lon: Math.round(position.lon * 100) / 100,
  };
}

/**
 * Varsayilan saklama sureleri (gun).
 * Kamera kayitlarinda Kurul yaklasimi "amac icin gerekli asgari sure"dir;
 * sektor uygulamasi 30 gundur. Olaya bagli kayitlar dava zamanasimi
 * gozetilerek daha uzun tutulur.
 */
export const DEFAULT_RETENTION_DAYS: Record<string, number> = {
  camera_recording: 30,
  camera_event_clip: 180,
  cabin_event_clip: 90,
  position: 365,
  work_session: 1825, // 5 yil - hakedis/is hukuku ispat yuku
  billing: 3650, // 10 yil - TTK/VUK saklama yukumlulugu
  audit_log: 730,
  fuel_event: 730,
};

/** Bir kaydin imha tarihini hesaplar. */
export function retentionDeadline(dataType: string, createdAt: Date, overrideDays?: number): Date {
  const days = overrideDays ?? DEFAULT_RETENTION_DAYS[dataType] ?? 30;
  return new Date(createdAt.getTime() + days * 86_400_000);
}
