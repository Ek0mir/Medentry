/** API sunucusu. */

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerErrorHandler } from './auth/context.js';
import { config } from './config.js';
import { closePool, query } from './db/pool.js';
import { closeStaleSessions, runRollup } from './jobs/rollup.js';
import { runRetention } from './jobs/retention.js';
import { authRoutes } from './routes/auth.js';
import { billingRoutes } from './routes/billing.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { fleetRoutes } from './routes/fleet.js';
import { ingestRoutes } from './routes/ingest.js';
import { kvkkRoutes } from './routes/kvkk.js';
import { mediaRoutes } from './routes/media.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.env === 'test'
        ? false
        : {
            level: config.isProduction ? 'info' : 'debug',
            // Kisisel veri iceren basliklar loglanmaz.
            redact: ['req.headers.authorization', 'req.headers["x-ingest-key"]'],
          },
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  });

  registerErrorHandler(app);

  app.get('/health', async () => {
    const row = await query<{ ok: number }>('SELECT 1 AS ok');
    return { ok: row.length > 0, env: config.env, ts: new Date().toISOString() };
  });

  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(fleetRoutes);
  await app.register(mediaRoutes);
  await app.register(billingRoutes);
  await app.register(kvkkRoutes);
  await app.register(ingestRoutes);

  return app;
}

/** Periyodik isler. Tek surec varsayimiyla calisir; olcekleme durumunda
 *  bunlar ayri bir zamanlayici surece tasinmalidir. */
function startJobs(app: FastifyInstance): NodeJS.Timeout[] {
  const timers: NodeJS.Timeout[] = [];

  const safeRun = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      const result = await fn();
      app.log.info({ job: name, result }, 'periyodik is tamamlandi');
    } catch (error) {
      app.log.error({ job: name, err: error }, 'periyodik is hatasi');
    }
  };

  timers.push(
    setInterval(() => void safeRun('rollup', runRollup), config.jobs.rollupIntervalMs),
    setInterval(
      () => void safeRun('stale_sessions', () => closeStaleSessions(config.sessions.maxDataGapSec)),
      config.jobs.staleSessionIntervalMs,
    ),
  );

  if (config.jobs.retentionEnabled) {
    timers.push(setInterval(() => void safeRun('retention', runRetention), config.jobs.retentionIntervalMs));
  }

  return timers;
}

async function main(): Promise<void> {
  const app = await buildServer();
  const timers = startJobs(app);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'kapatiliyor');
    for (const timer of timers) clearInterval(timer);
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`API hazir: http://${config.host}:${config.port}`);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('server.ts') || entry.endsWith('server.js')) {
  main().catch((error) => {
    console.error('Sunucu baslatilamadi:', error);
    process.exit(1);
  });
}
