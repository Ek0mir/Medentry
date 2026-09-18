/**
 * Parola ozetleme (scrypt).
 *
 * Node'un yerlesik scrypt'i kullanilir: harici bagimlilik yok, bellek-sert
 * fonksiyon oldugu icin GPU saldirilarina karsi bcrypt'ten daha dirençli.
 * Bicim: scrypt$N$r$p$<tuz-b64>$<ozet-b64>
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const PARAMS = { N: 16_384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error('Parola en az 8 karakter olmalidir');
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), derived.toString('base64')].join(
    '$',
  );
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64!, 'base64');
    const expected = Buffer.from(hashB64!, 'base64');
    const derived = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    // Sabit zamanli karsilastirma: zamanlama sizintisini engeller.
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
