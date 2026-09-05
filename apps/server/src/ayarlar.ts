import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// .env varsa ortama yükle (Node 22 yerleşiği; ek bağımlılık yok).
// Zaten tanımlı değişkenlerin üzerine yazmaz.
for (const aday of ['.env', '../../.env', '../../../.env']) {
  const yol = resolve(process.cwd(), aday);
  if (existsSync(yol)) {
    process.loadEnvFile(yol);
    break;
  }
}

/**
 * Ortam değişkenleri tek yerden okunur ve açılışta doğrulanır.
 * Eksik/yanlış bir değer varsa uygulama yarı çalışır durumda ayağa kalkmaz.
 */
const sema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  TZ: z.string().default('Europe/Istanbul'),
  OTURUM_SIRRI: z.string().min(16, 'OTURUM_SIRRI en az 16 karakter olmalı'),
  DATABASE_URL: z.string().min(1),

  MIKRO_ADAPTER: z.enum(['seed', 'csv', 'mssql']).default('seed'),
  MIKRO_CSV_DIZIN: z.string().default('./veri/mikro-export'),
  MIKRO_MSSQL_SUNUCU: z.string().optional(),
  MIKRO_MSSQL_PORT: z.coerce.number().int().positive().default(1433),
  MIKRO_MSSQL_VERITABANI: z.string().optional(),
  MIKRO_MSSQL_KULLANICI: z.string().optional(),
  MIKRO_MSSQL_PAROLA: z.string().optional(),
  MIKRO_MSSQL_SIFRELI: z
    .string()
    .default('false')
    .transform((d) => d === 'true' || d === '1'),

  ISLER_ACIK: z
    .string()
    .default('1')
    .transform((d) => d === 'true' || d === '1'),
  YEDEK_DIZIN: z.string().default('./yedek'),
  YEDEK_SAKLAMA_GUN: z.coerce.number().int().positive().default(14),
});

function oku() {
  // Geliştirme ve testte sır zorunluluğunu makul bir varsayılanla karşılıyoruz;
  // üretimde .env'den gelmezse aşağıdaki doğrulama uygulamayı durdurur.
  const ham = { ...process.env };
  if (!ham.OTURUM_SIRRI && ham.NODE_ENV !== 'production') {
    ham.OTURUM_SIRRI = 'gelistirme-ortami-icin-sabit-sir-degeri';
  }
  const sonuc = sema.safeParse(ham);
  if (!sonuc.success) {
    const satirlar = sonuc.error.issues.map((h) => `  - ${h.path.join('.')}: ${h.message}`);
    throw new Error(`Ortam değişkenleri hatalı:\n${satirlar.join('\n')}`);
  }
  return sonuc.data;
}

export const ayarlar = oku();
export type Ayarlar = typeof ayarlar;

/** Uygulama genelinde kullanılan saat dilimi. Tüm iş saatleri buna göre yorumlanır. */
export const SAAT_DILIMI = ayarlar.TZ;
