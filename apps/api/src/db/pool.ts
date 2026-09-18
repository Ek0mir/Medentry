/** PostgreSQL baglanti havuzu ve sorgu yardimcilari. */

import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;

// numeric (NUMERIC/DECIMAL) varsayilan olarak string doner; parasal alanlarda
// JS number'a cevirmek istiyoruz. Hassasiyet: 2 ondalik, guvenli aralikta.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
// int8 (bigint) -> number. Konum id'leri ve saniye degerleri guvenli aralikta.
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  // Havuzdaki bosta baglantida hata: sureci dusurme, logla.
  console.error('[db] havuz hatasi', error);
});

export type QueryParam = string | number | boolean | Date | null | undefined | string[] | number[];

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: readonly QueryParam[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends object = Record<string, unknown>>(
  text: string,
  params: readonly QueryParam[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Islem (transaction) icinde calistirir; hata halinde geri alir. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
