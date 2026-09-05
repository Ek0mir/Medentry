import pg from 'pg';
import { ayarlar } from '../ayarlar.js';

/**
 * numeric/int8 sütunları JS number'a çevir.
 * Varsayılanda pg bunları string döndürür; para alanlarını her yerde
 * elle parse etmek yerine tek noktada hallediyoruz.
 *
 * Tutarlarımız TL bazında ve 10^15'in çok altında; double kesinliği yeterli.
 */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (d) => (d === null ? null : Number(d)));
pg.types.setTypeParser(pg.types.builtins.INT8, (d) => (d === null ? null : Number(d)));
// date (1082) string kalsın: 'YYYY-MM-DD' olarak taşımak saat dilimi sürprizlerini önler.
pg.types.setTypeParser(pg.types.builtins.DATE, (d) => d);

export const havuz = new pg.Pool({
  connectionString: ayarlar.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export type Sorgulanabilir = Pick<pg.PoolClient, 'query'>;

export async function sorgu<S extends pg.QueryResultRow = pg.QueryResultRow>(
  metin: string,
  degerler: readonly unknown[] = [],
  istemci: Sorgulanabilir = havuz,
): Promise<S[]> {
  const sonuc = await istemci.query<S>(metin, degerler as unknown[]);
  return sonuc.rows;
}

export async function tekSatir<S extends pg.QueryResultRow = pg.QueryResultRow>(
  metin: string,
  degerler: readonly unknown[] = [],
  istemci: Sorgulanabilir = havuz,
): Promise<S | undefined> {
  const satirlar = await sorgu<S>(metin, degerler, istemci);
  return satirlar[0];
}

/** İşlem (transaction) içinde çalıştırır; hata olursa geri alır. */
export async function islem<S>(is: (istemci: pg.PoolClient) => Promise<S>): Promise<S> {
  const istemci = await havuz.connect();
  try {
    await istemci.query('BEGIN');
    const sonuc = await is(istemci);
    await istemci.query('COMMIT');
    return sonuc;
  } catch (hata) {
    await istemci.query('ROLLBACK');
    throw hata;
  } finally {
    istemci.release();
  }
}

export async function havuzuKapat(): Promise<void> {
  await havuz.end();
}
