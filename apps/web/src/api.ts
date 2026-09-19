/** API istemcisi ve paylasilan tipler. */

const TOKEN_KEY = 'medentry.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ozel sekmede depolama kapali olabilir */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    setToken(null);
    throw new ApiError(401, 'Oturum suresi doldu, tekrar giris yapin', 'UNAUTHORIZED');
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof body['error'] === 'string' ? body['error'] : 'Beklenmeyen hata',
      typeof body['code'] === 'string' ? body['code'] : undefined,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  company: { name: string; timezone: string; kvkkContact: string | null };
  pendingNotices: Array<{ id: string; kind: string; title: string; version: string }>;
}

export interface CameraDto {
  id: string;
  channelNo: number;
  position: string;
  positionLabel: string;
  label: string | null;
  privacyClass: string;
  recordsAudio: boolean;
  eventOnly: boolean;
  sdRecording: boolean;
  /** integrated: platform uzerinden | manual: SD karttan elle alinir. */
  retrieval: 'integrated' | 'manual';
  deviceModel: string | null;
  liveAllowed: boolean;
  liveBlockedReason: string | null;
}

export interface SettingsDto {
  name: string;
  timezone: string;
  currency: string;
  solo_mode: boolean;
  kvkk_contact_email: string | null;
}

export interface ClipWindowDto {
  eventId: number;
  eventType: string;
  severity: string;
  assetName: string;
  eventAt: string;
  timezone: string;
  windowFrom: string;
  windowTo: string;
  recorders: Array<{
    cameraId: string;
    label: string;
    retrieval: string;
    deviceModel: string | null;
    clockOffsetSec: number;
    searchFrom: string;
    searchTo: string;
    note: string;
  }>;
}

export interface FuelSummaryDto {
  from: string;
  purchasedLiters: number;
  cost: number;
  engineHours: number;
  measuredLitersPerHour: number | null;
  nominalLitersPerHour: number | null;
  costPerHour: number | null;
  note: string;
}

export interface AssetDto {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  typeLabel: string;
  plate: string | null;
  project: string | null;
  status: 'working' | 'idle' | 'stopped' | 'offline';
  position: {
    lat: number;
    lon: number;
    speedKph: number;
    headingDeg: number | null;
    ts: string | null;
    ageSec: number | null;
  } | null;
  geofences: Array<{ id: string; name: string; purpose: string }>;
  today: {
    firstStartAt: string | null;
    lastStopAt: string | null;
    sessionCount: number;
    engineHours: number;
    idleHours: number;
    workingHours: number;
    running: boolean;
  };
  operator: { id: string; name: string | null; phone: string | null; source: string | null } | null;
  fuel: {
    levelPct: number | null;
    tankLiters: number | null;
    usedLitersToday: number;
    engineHoursTotal: number | null;
    odometerKm: number | null;
    nominalLitersPerHour: number | null;
  };
  /** Takip cihazi yoksa calisma saati elle girilir. */
  hasTracker: boolean;
  cameras: CameraDto[];
  billing: { billableHours: number; amountTotal: number; currency: string; status: string } | null;
  alerts: Array<{ id: number; type: string; severity: string; ts: string }>;
}

export interface DashboardDto {
  generatedAt: string;
  date: string;
  timezone: string;
  totals: {
    assets: number;
    working: number;
    idle: number;
    stopped: number;
    offline: number;
    engineHours: number;
    billableHours: number;
    amountTotal: number;
    currency: string;
  };
  assets: AssetDto[];
}

export interface BillingLineDto {
  code: string;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface AssetDetailDto {
  date: string;
  timezone: string;
  asset: AssetDto;
  sessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number;
    idleSec: number;
    workingSec: number;
    distanceKm: number;
    open: boolean;
    operator: string | null;
  }>;
  billing: {
    billableHours: number;
    normalHours: number;
    overtimeHours: number;
    idleHours: number;
    engineHours: number;
    amountNet: number;
    amountVat: number;
    amountTotal: number;
    currency: string;
    status: string;
    lines: BillingLineDto[];
  } | null;
  track: Array<{ ts: string; lat: number; lon: number; speedKph: number; ignition: boolean | null }>;
}

export interface LiveStreamDto {
  sessionId: string;
  playbackUrl: string;
  protocol: string;
  expiresAt: string;
  maxDurationSec: number;
  audio: boolean;
  note?: string;
  notice: string;
  obligations: string[];
}

export interface PurposeDto {
  code: string;
  label: string;
  legalBasis: string;
  description: string;
}

export interface ComplianceDto {
  score: number;
  checks: Array<{ code: string; label: string; ok: boolean; detail: string }>;
  stats: {
    usersTotal: number;
    usersAcknowledged: number;
    deniedLast30d: number;
    cameraViewsLast30d: number;
    cabinCameras: number;
  };
}

export interface AccessLogDto {
  ts: string;
  action: string;
  data_type: string;
  purpose: string;
  purposeLabel: string;
  reason: string | null;
  result: string;
  asset_name: string | null;
  viewer_name: string | null;
  viewer_role: string | null;
}

export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
