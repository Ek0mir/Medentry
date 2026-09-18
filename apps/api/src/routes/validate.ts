/** Kucuk dogrulama yardimcilari (harici sema kutuphanesi olmadan). */

import { HttpError } from '../auth/context.js';

type Body = Record<string, unknown> | undefined | null;

export function str(body: Body, field: string, options: { min?: number; max?: number } = {}): string {
  const value = body?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `"${field}" alani zorunludur`, 'FIELD_REQUIRED', { field });
  }
  const trimmed = value.trim();
  if (options.min && trimmed.length < options.min) {
    throw new HttpError(400, `"${field}" en az ${options.min} karakter olmalidir`, 'FIELD_TOO_SHORT', { field });
  }
  if (options.max && trimmed.length > options.max) {
    throw new HttpError(400, `"${field}" en fazla ${options.max} karakter olabilir`, 'FIELD_TOO_LONG', { field });
  }
  return trimmed;
}

export function optionalStr(body: Body, field: string): string | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, `"${field}" metin olmalidir`, 'FIELD_TYPE', { field });
  }
  return value.trim();
}

export function num(body: Body, field: string, options: { min?: number; max?: number } = {}): number {
  const value = Number(body?.[field]);
  if (!Number.isFinite(value)) {
    throw new HttpError(400, `"${field}" sayi olmalidir`, 'FIELD_TYPE', { field });
  }
  if (options.min !== undefined && value < options.min) {
    throw new HttpError(400, `"${field}" en az ${options.min} olmalidir`, 'FIELD_RANGE', { field });
  }
  if (options.max !== undefined && value > options.max) {
    throw new HttpError(400, `"${field}" en fazla ${options.max} olabilir`, 'FIELD_RANGE', { field });
  }
  return value;
}

export function optionalNum(body: Body, field: string): number | undefined {
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === '') return undefined;
  return num(body, field);
}

export function bool(body: Body, field: string, fallback: boolean): boolean {
  const value = body?.[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'evet'].includes(value.toLowerCase());
  return Boolean(value);
}

export function date(value: unknown, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `"${field}" gecerli bir tarih olmalidir`, 'FIELD_DATE', { field });
  }
  return parsed;
}

export function optionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return date(value, field);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(value: unknown, field: string): string {
  const text = String(value ?? '');
  if (!UUID_RE.test(text)) {
    throw new HttpError(400, `"${field}" gecerli bir kimlik olmalidir`, 'FIELD_UUID', { field });
  }
  return text;
}

/** "YYYY-MM-DD" gun anahtari. */
export function dateKey(value: unknown, field: string): string {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, `"${field}" YYYY-AA-GG bicimde olmalidir`, 'FIELD_DATEKEY', { field });
  }
  return text;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const text = String(value ?? '');
  if (!allowed.includes(text as T)) {
    throw new HttpError(400, `"${field}" su degerlerden biri olmalidir: ${allowed.join(', ')}`, 'FIELD_ENUM', {
      field,
      allowed,
    });
  }
  return text as T;
}

/** Sorgu parametresinden sayfa boyutu. */
export function limit(value: unknown, fallback = 100, max = 1000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
