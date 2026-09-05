import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  parola: string | Buffer,
  tuz: string | Buffer,
  uzunluk: number,
) => Promise<Buffer>;

const TUZ_UZUNLUK = 16;
const ANAHTAR_UZUNLUK = 64;

/**
 * Parola özeti — Node'un yerleşik scrypt'i.
 * Derleme gerektiren bir bağımlılık (argon2/bcrypt) eklemiyoruz: mini PC'de
 * kurulumu basit tutmak, tek `docker compose up` hedefinin parçası.
 */
export async function sifreOzetle(parola: string): Promise<string> {
  const tuz = randomBytes(TUZ_UZUNLUK);
  const anahtar = await scrypt(parola.normalize('NFKC'), tuz, ANAHTAR_UZUNLUK);
  return `scrypt$${tuz.toString('hex')}$${anahtar.toString('hex')}`;
}

export async function sifreDogrula(parola: string, ozet: string): Promise<boolean> {
  const parcalar = ozet.split('$');
  if (parcalar.length !== 3 || parcalar[0] !== 'scrypt') return false;
  const tuz = Buffer.from(parcalar[1]!, 'hex');
  const beklenen = Buffer.from(parcalar[2]!, 'hex');
  const anahtar = await scrypt(parola.normalize('NFKC'), tuz, beklenen.length);
  return anahtar.length === beklenen.length && timingSafeEqual(anahtar, beklenen);
}

/** Okunabilir, kopyalanabilir rastgele parola (tohumlama ve API anahtarı için). */
export function rastgeleParola(uzunluk = 14): string {
  // Karıştırılabilecek karakterler (0/O, 1/l/I) kasten dışarıda.
  const alfabe = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
  const baytlar = randomBytes(uzunluk);
  let sonuc = '';
  for (let i = 0; i < uzunluk; i++) sonuc += alfabe[baytlar[i]! % alfabe.length];
  return sonuc;
}
