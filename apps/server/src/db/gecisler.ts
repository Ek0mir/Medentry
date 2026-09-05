import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { havuz, sorgu } from './havuz.js';

const buDosya = dirname(fileURLToPath(import.meta.url));

async function dizinVar(yol: string): Promise<boolean> {
  try {
    await readdir(yol);
    return true;
  } catch {
    return false;
  }
}

async function cozulmusDizin(): Promise<string> {
  const adaylar = [
    resolve(buDosya, '../../../../db/migrations'),
    resolve(buDosya, '../../../db/migrations'),
    resolve(process.cwd(), 'db/migrations'),
    resolve(process.cwd(), '../../db/migrations'),
  ];
  for (const aday of adaylar) {
    if (await dizinVar(aday)) return aday;
  }
  throw new Error(`db/migrations dizini bulunamadı. Denenenler:\n${adaylar.join('\n')}`);
}

/**
 * Numaralı SQL dosyalarını sırayla, bir kez çalıştırır.
 * Uygulananlar _gecis tablosunda tutulur. ORM yok, sihir yok.
 */
export async function gecisleriCalistir(): Promise<string[]> {
  const dizin = await cozulmusDizin();
  const dosyalar = (await readdir(dizin)).filter((d) => d.endsWith('.sql')).sort();

  await havuz.query(`
    CREATE TABLE IF NOT EXISTS _gecis (
      ad          text PRIMARY KEY,
      uygulama_ts timestamptz NOT NULL DEFAULT now()
    )`);

  const uygulanmis = new Set(
    (await sorgu<{ ad: string }>('SELECT ad FROM _gecis')).map((s) => s.ad),
  );

  const yeniler: string[] = [];
  for (const dosya of dosyalar) {
    if (uygulanmis.has(dosya)) continue;
    const sql = await readFile(join(dizin, dosya), 'utf8');
    const istemci = await havuz.connect();
    try {
      await istemci.query('BEGIN');
      await istemci.query(sql);
      await istemci.query('INSERT INTO _gecis (ad) VALUES ($1)', [dosya]);
      await istemci.query('COMMIT');
      yeniler.push(dosya);
    } catch (hata) {
      await istemci.query('ROLLBACK');
      throw new Error(`Geçiş başarısız: ${dosya}\n${(hata as Error).message}`);
    } finally {
      istemci.release();
    }
  }
  return yeniler;
}
