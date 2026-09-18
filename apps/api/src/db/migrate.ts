/**
 * Basit, ileri yonlu gec (migration) calistirici.
 * `src/db/migrations` altindaki .sql dosyalarini isim sirasina gore bir kez
 * calistirir ve `schema_migrations` tablosuna yazar.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, pool } from './pool.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
    );

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      // Her gec kendi isleminde: yarim kalan bir gec semayi bozmaz.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        if (process.env['NODE_ENV'] !== 'test') console.log(`[migrate] uygulandi: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Gec basarisiz (${file}): ${error instanceof Error ? error.message : error}`);
      }
    }

    if (applied.length === 0 && process.env['NODE_ENV'] !== 'test') console.log('[migrate] sema guncel');
    return applied;
  } finally {
    client.release();
  }
}

const isDirectRun = process.argv[1]?.includes('migrate');
if (isDirectRun) {
  migrate()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[migrate] hata:', error);
      process.exit(1);
    });
}
