/** API testleri icin ortak yardimcilar. */

import pg from 'pg';
import type { FastifyInstance } from 'fastify';

const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgres://medentry:medentry@127.0.0.1:5432/medentry_test';

/** Veritabani erisilemiyorsa testler atlanir (CI'da PostgreSQL olmayabilir). */
export async function databaseAvailable(): Promise<boolean> {
  const adminUrl = TEST_DB_URL.replace(/\/[^/]*$/, '/postgres');
  const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** Test veritabanini bastan olusturur. */
export async function resetTestDatabase(): Promise<void> {
  const dbName = TEST_DB_URL.split('/').pop()!.split('?')[0]!;
  // Tanimlayici SQL'e dogrudan yazildigi icin adi kisitliyoruz.
  if (!/^[a-z0-9_]+$/i.test(dbName)) {
    throw new Error(`Gecersiz test veritabani adi: ${dbName}`);
  }
  const adminUrl = TEST_DB_URL.replace(/\/[^/]*$/, '/postgres');
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
}

export interface TestContext {
  app: FastifyInstance;
  tokens: Record<string, string>;
  close: () => Promise<void>;
}

const SEED_PASSWORD = 'Medentry2026!';

/** Sunucuyu ayaga kaldirir, demo veriyi yukler ve oturum jetonlarini alir. */
export async function startTestServer(): Promise<TestContext> {
  const { seed } = await import('../src/db/seed.js');
  await seed();

  const { buildServer } = await import('../src/server.js');
  const app = await buildServer();
  await app.ready();

  const login = async (email: string): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: SEED_PASSWORD },
    });
    if (response.statusCode !== 200) {
      throw new Error(`Giris basarisiz (${email}): ${response.body}`);
    }
    return (response.json() as { token: string }).token;
  };

  const tokens: Record<string, string> = {
    owner: await login('sahip@ornek-firma.com.tr'),
    manager: await login('yonetici@ornek-firma.com.tr'),
    siteChief: await login('sef@ornek-firma.com.tr'),
    dpo: await login('kvkk@ornek-firma.com.tr'),
    operator: await login('operator1@ornek-firma.com.tr'),
    viewer: await login('muhasebe@ornek-firma.com.tr'),
  };

  return {
    app,
    tokens,
    close: async () => {
      await app.close();
      const { closePool } = await import('../src/db/pool.js');
      await closePool();
    },
  };
}

export function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
