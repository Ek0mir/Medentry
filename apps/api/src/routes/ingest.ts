/**
 * Telemetri girisi.
 *
 * Iki kaynak vardir:
 *  1) /api/ingest          - JSON konusan cihazlar ve operator telefon
 *                            uygulamasi (esnek sema)
 *  2) /api/ingest/decoded  - TCP ingest sunucusunun (GT06/Teltonika/JT808)
 *                            cozup ilettigi normalize kayitlar
 *
 * Kimlik dogrulama paylasilan anahtar (INGEST_KEY) ile yapilir; kullanici
 * oturumu gerektirmez. Uretimde bu uc yalnizca ic aga acilmalidir.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { normalizeGenericBatch } from '@medentry/protocols';
import type { NormalizedRecord } from '@medentry/shared';
import { HttpError } from '../auth/context.js';
import { config } from '../config.js';
import { ingestRecords } from '../pipeline/ingest.js';

function assertIngestKey(request: FastifyRequest): void {
  const key = request.headers['x-ingest-key'];
  if (typeof key !== 'string' || key !== config.ingestKey) {
    throw new HttpError(401, 'Gecersiz ingest anahtari', 'INVALID_INGEST_KEY');
  }
}

/** JSON uzerinden gelen kayitta tarih alanlari metindir; Date'e cevrilir. */
function reviveRecord(raw: Record<string, unknown>): NormalizedRecord {
  const record = { ...raw } as unknown as NormalizedRecord;
  record.timestamp = new Date(String(raw['timestamp']));
  if (Number.isNaN(record.timestamp.getTime())) {
    throw new HttpError(400, 'Gecersiz zaman damgasi', 'INVALID_TIMESTAMP');
  }
  return record;
}

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ingest', async (request, reply) => {
    assertIngestKey(request);
    const body = request.body as Record<string, unknown> | Array<Record<string, unknown>>;

    let records: NormalizedRecord[];
    try {
      records = normalizeGenericBatch(body);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Gecersiz veri', 'INVALID_PAYLOAD');
    }

    const result = await ingestRecords(records);
    if (result.unknownDevices.length > 0) {
      request.log.warn({ unknownDevices: result.unknownDevices }, 'tanimsiz cihazdan veri geldi');
    }
    return reply.send(result);
  });

  app.post('/api/ingest/decoded', async (request, reply) => {
    assertIngestKey(request);
    const body = request.body as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(body?.records)) {
      throw new HttpError(400, '"records" dizisi bekleniyor', 'INVALID_PAYLOAD');
    }

    const records = body.records.map(reviveRecord);
    const result = await ingestRecords(records);
    return reply.send(result);
  });

  /** Ingest sunucusunun saglik bildirimi. */
  app.get('/api/ingest/health', async (request) => {
    assertIngestKey(request);
    return { ok: true, ts: new Date().toISOString() };
  });
}
