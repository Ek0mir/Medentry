/**
 * Cihaz baglanti sunucusu (ingest).
 *
 * Gorevleri:
 *  1) Her protokol icin bir TCP dinleyicisi acar (GT06, Teltonika, JT808)
 *  2) Gelen cerceveleri cozer, cihaza ack gonderir
 *  3) Normalize kayitlari API'ye toplu olarak iletir
 *  4) Kamera komutlari icin acik soketleri tutar ve API'den gelen komut
 *     isteklerini ilgili cihaza yazar (JT/T 1078 canli yayin, geri oynatma)
 *
 * API'den ayri bir surec olmasinin sebebi: cihaz baglantilari uzun omurludur
 * ve API surecinin yeniden baslatilmasindan etkilenmemelidir.
 */

import { createServer as createTcpServer } from 'node:net';
import type { Socket } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { getDecoder } from '@medentry/protocols';
import type { DecodedMessage, DecoderSession, ProtocolDecoder } from '@medentry/protocols';
import type { NormalizedRecord, ProtocolName } from '@medentry/shared';

const API_URL = process.env['API_URL'] ?? 'http://127.0.0.1:8080';
const INGEST_KEY = process.env['INGEST_KEY'] ?? 'gelistirme-ingest-anahtari';
const COMMAND_PORT = Number(process.env['COMMAND_PORT'] ?? 8081);

/** Protokol -> dinlenecek port. */
const PORTS: Record<string, number> = {
  gt06: Number(process.env['PORT_GT06'] ?? 5023),
  teltonika: Number(process.env['PORT_TELTONIKA'] ?? 5027),
  jt808: Number(process.env['PORT_JT808'] ?? 7611),
};

/** Kayitlar tek tek degil, kucuk gruplar halinde gonderilir. */
const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 50;

interface Connection {
  socket: Socket;
  protocol: ProtocolName;
  session: DecoderSession;
  buffer: Buffer;
  lastSeen: number;
  /** Cihazdan yanit bekleyen komutlar. */
  pending: Map<string, (message: DecodedMessage) => void>;
}

/** Acik cihaz baglantilari: ident -> baglanti. */
const connections = new Map<string, Connection>();
const queue: NormalizedRecord[] = [];

function log(...args: unknown[]): void {
  console.log(`[ingest ${new Date().toISOString()}]`, ...args);
}

// ---------------------------------------------------------------------------
// TCP dinleyicileri
// ---------------------------------------------------------------------------

function startListener(protocol: ProtocolName, port: number): void {
  const decoder = getDecoder(protocol);

  const server = createTcpServer((socket) => {
    const connection: Connection = {
      socket,
      protocol,
      session: {},
      buffer: Buffer.alloc(0),
      lastSeen: Date.now(),
      pending: new Map(),
    };

    // Cihaz sessiz kalirsa soketi birak: mobil sebekede yarim acik
    // baglantilar birikir.
    socket.setTimeout(10 * 60_000);
    socket.setKeepAlive(true, 60_000);

    socket.on('data', (chunk) => {
      connection.lastSeen = Date.now();
      connection.buffer = Buffer.concat([connection.buffer, chunk]);
      handleData(connection, decoder);
    });

    socket.on('timeout', () => {
      log(`zaman asimi, baglanti kapatiliyor: ${connection.session.deviceIdent ?? 'kimliksiz'}`);
      socket.destroy();
    });

    socket.on('error', (error) => {
      log(`soket hatasi (${protocol}):`, error.message);
    });

    socket.on('close', () => {
      const ident = connection.session.deviceIdent as string | undefined;
      if (ident && connections.get(ident) === connection) connections.delete(ident);
    });
  });

  server.listen(port, () => log(`${protocol} dinleniyor: tcp/${port}`));
  server.on('error', (error) => log(`${protocol} sunucu hatasi:`, error));
}

function handleData(connection: Connection, decoder: ProtocolDecoder): void {
  let result;
  try {
    result = decoder.decode(connection.buffer, connection.session);
  } catch (error) {
    log('cozumleme hatasi:', error);
    connection.buffer = Buffer.alloc(0);
    return;
  }
  connection.buffer = result.rest;

  for (const message of result.messages) {
    if (message.ack && !connection.socket.destroyed) {
      connection.socket.write(message.ack);
    }

    const ident = (message.deviceIdent ?? connection.session.deviceIdent) as string | undefined;
    if (ident) {
      const previous = connections.get(ident);
      if (previous && previous !== connection) {
        // Ayni cihaz yeniden baglandi: eski soketi kapat.
        previous.socket.destroy();
      }
      connections.set(ident, connection);
    }

    // Komut yaniti bekleyen varsa ona ilet.
    if (message.kind === 'media' || message.kind === 'response') {
      for (const [key, resolve] of connection.pending) {
        resolve(message);
        connection.pending.delete(key);
      }
    }

    if (message.record) {
      queue.push(message.record);
      const extra = message.meta?.['records'];
      if (Array.isArray(extra)) {
        for (const item of extra.slice(1)) queue.push(item as NormalizedRecord);
      }
    }

    if (message.kind === 'login') {
      log(`cihaz baglandi: ${ident} (${connection.protocol})`);
    }
  }

  if (queue.length >= FLUSH_BATCH_SIZE) void flush();
}

// ---------------------------------------------------------------------------
// API'ye aktarim
// ---------------------------------------------------------------------------

let flushing = false;

async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, 500);

  try {
    const response = await fetch(`${API_URL}/api/ingest/decoded`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-key': INGEST_KEY },
      body: JSON.stringify({ records: batch }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
    }
    const result = (await response.json()) as { accepted: number; skipped: number };
    if (result.skipped > 0) log(`${result.accepted} kayit islendi, ${result.skipped} tanimsiz cihaz`);
  } catch (error) {
    log('API aktarimi basarisiz, kayitlar kuyruga geri konuyor:', error);
    // Veri kaybetmemek icin basa ekle; kuyruk cok buyurse en eskiyi dusur.
    queue.unshift(...batch);
    if (queue.length > 20_000) queue.splice(0, queue.length - 20_000);
  } finally {
    flushing = false;
  }
}

// ---------------------------------------------------------------------------
// Komut kanali (API -> cihaz)
// ---------------------------------------------------------------------------

function startCommandServer(): void {
  const server = createHttpServer((req, res) => {
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.headers['x-ingest-key'] !== INGEST_KEY) {
      send(401, { ok: false, error: 'Gecersiz anahtar' });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      send(200, { ok: true, connections: connections.size, queued: queue.length });
      return;
    }

    if (req.method !== 'POST' || !req.url?.startsWith('/command')) {
      send(404, { ok: false, error: 'Bulunamadi' });
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            ident: string;
            frameHex: string;
            expectReply?: string;
            timeoutMs?: number;
          };
          const result = await sendToDevice(payload);
          send(200, result);
        } catch (error) {
          send(200, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
    });
  });

  server.listen(COMMAND_PORT, () => log(`komut kanali dinleniyor: http://127.0.0.1:${COMMAND_PORT}`));
}

async function sendToDevice(payload: {
  ident: string;
  frameHex: string;
  expectReply?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; error?: string; payload?: unknown }> {
  const connection = connections.get(payload.ident);
  if (!connection || connection.socket.destroyed) {
    return { ok: false, error: `Cihaz cevrimdisi: ${payload.ident}` };
  }

  const frame = Buffer.from(payload.frameHex, 'hex');
  connection.socket.write(frame);

  if (!payload.expectReply) return { ok: true };

  // Cihazdan yanit bekle (or. SD kayit listesi).
  const timeoutMs = payload.timeoutMs ?? 8000;
  const key = `${payload.expectReply}-${Date.now()}`;

  const reply = await new Promise<DecodedMessage | null>((resolve) => {
    const timer = setTimeout(() => {
      connection.pending.delete(key);
      resolve(null);
    }, timeoutMs);

    connection.pending.set(key, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });

  if (!reply) return { ok: false, error: 'Cihaz zamaninda yanit vermedi' };
  return { ok: true, payload: reply.meta?.['resources'] ?? reply.meta };
}

// ---------------------------------------------------------------------------

function main(): void {
  for (const [protocol, port] of Object.entries(PORTS)) {
    startListener(protocol as ProtocolName, port);
  }
  startCommandServer();

  setInterval(() => void flush(), FLUSH_INTERVAL_MS);

  const shutdown = (): void => {
    log('kapatiliyor...');
    for (const connection of connections.values()) connection.socket.destroy();
    void flush().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  log(`API hedefi: ${API_URL}`);
}

main();
