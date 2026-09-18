/**
 * HS256 JWT uretimi ve dogrulamasi (node:crypto ile, harici bagimlilik yok).
 * Ayrica kisa omurlu yayin (stream) jetonlari icin ayni altyapi kullanilir.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import type { UserRole } from '@medentry/shared';

export interface TokenPayload {
  /** Kullanici kimligi. */
  sub: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
  iat: number;
  exp: number;
  /** Yayin jetonlarinda dolu: hangi kamera/oturum icin gecerli. */
  mediaSessionId?: string;
  cameraId?: string;
  scope?: 'api' | 'stream';
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

function sign(data: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

export function createToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  ttlSeconds: number = config.jwtTtlSeconds,
  secret: string = config.jwtSecret,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: TokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify(body));
  const data = `${header}.${claims}`;
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyToken(token: string, secret: string = config.jwtSecret): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, claims, signature] = parts as [string, string, string];

  const expected = sign(`${header}.${claims}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };

  try {
    const payload = JSON.parse(fromBase64url(claims).toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

/**
 * Kamera yayini icin kisa omurlu jeton.
 * Canli goruntu baglantisi paylasilsa bile birkac dakika sonra gecersizdir.
 */
export function createStreamToken(params: {
  userId: string;
  companyId: string;
  role: UserRole;
  mediaSessionId: string;
  cameraId: string;
  ttlSeconds?: number;
}): string {
  return createToken(
    {
      sub: params.userId,
      companyId: params.companyId,
      role: params.role,
      email: '',
      name: '',
      scope: 'stream',
      mediaSessionId: params.mediaSessionId,
      cameraId: params.cameraId,
    },
    params.ttlSeconds ?? config.media.streamTokenTtlSeconds,
  );
}
