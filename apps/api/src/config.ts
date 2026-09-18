/** Ortam degiskenlerinden yapilandirma. */

function env(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Zorunlu ortam degiskeni eksik: ${key}`);
  }
  return value;
}

function envNumber(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${key} sayi olmali`);
  return parsed;
}

const isProduction = process.env['NODE_ENV'] === 'production';

export const config = {
  env: process.env['NODE_ENV'] ?? 'development',
  isProduction,
  host: env('HOST', '0.0.0.0'),
  port: envNumber('PORT', 8080),
  databaseUrl: env('DATABASE_URL', 'postgres://medentry:medentry@localhost:5432/medentry'),

  /**
   * JWT imzalama anahtari. Uretimde mutlaka ortamdan gelmelidir;
   * varsayilan deger yalnizca yerel gelistirme icindir.
   */
  jwtSecret: isProduction
    ? env('JWT_SECRET')
    : env('JWT_SECRET', 'gelistirme-ortami-icin-gecici-anahtar-degistirin'),
  jwtTtlSeconds: envNumber('JWT_TTL_SECONDS', 12 * 3600),

  /** Cihazlarin ingest ucuna gonderdigi paylasilan anahtar. */
  ingestKey: isProduction ? env('INGEST_KEY') : env('INGEST_KEY', 'gelistirme-ingest-anahtari'),

  /** Medya (kamera) altyapisi. */
  media: {
    // mock | jt1078
    provider: env('MEDIA_PROVIDER', 'mock'),
    /** Cihazlarin RTP akisini acacagi, disaridan erisilebilir adres. */
    gatewayHost: env('MEDIA_GATEWAY_HOST', '127.0.0.1'),
    gatewayTcpPort: envNumber('MEDIA_GATEWAY_TCP_PORT', 7618),
    gatewayUdpPort: envNumber('MEDIA_GATEWAY_UDP_PORT', 0),
    /** Izleyiciye verilen HLS/WebRTC taban adresi. */
    playbackBaseUrl: env('MEDIA_PLAYBACK_BASE_URL', 'http://127.0.0.1:8888'),
    /** Yayin jetonu omru - kisa tutulur, her izleme yeniden yetkilendirilir. */
    streamTokenTtlSeconds: envNumber('MEDIA_TOKEN_TTL_SECONDS', 120),
    /** Canli izleme oturumu bu sureden sonra otomatik kapanir. */
    liveSessionMaxSeconds: envNumber('MEDIA_LIVE_MAX_SECONDS', 300),
    /** JT808 komut kanalinin (ingest sunucusu) dahili adresi. */
    commandEndpoint: env('MEDIA_COMMAND_ENDPOINT', 'http://127.0.0.1:8081/command'),
    ftpHost: env('MEDIA_FTP_HOST', '127.0.0.1'),
    ftpPort: envNumber('MEDIA_FTP_PORT', 21),
    ftpUser: env('MEDIA_FTP_USER', 'mdvr'),
    ftpPassword: env('MEDIA_FTP_PASSWORD', 'mdvr'),
  },

  /** Oturum motoru varsayilanlari (varlik bazinda ezilebilir). */
  sessions: {
    mergeGapSec: envNumber('SESSION_MERGE_GAP_SEC', 180),
    minSessionSec: envNumber('SESSION_MIN_SEC', 60),
    maxDataGapSec: envNumber('SESSION_MAX_GAP_SEC', 1800),
    idleMinSec: envNumber('SESSION_IDLE_MIN_SEC', 300),
  },

  /** Periyodik isler. */
  jobs: {
    /** Saklama suresi dolan kayitlarin imhasi (cron: her gece 03:15). */
    retentionEnabled: env('JOB_RETENTION_ENABLED', 'true') === 'true',
    retentionIntervalMs: envNumber('JOB_RETENTION_INTERVAL_MS', 6 * 3600_000),
    /** Gunluk hakedis hesabi. */
    rollupIntervalMs: envNumber('JOB_ROLLUP_INTERVAL_MS', 15 * 60_000),
    /** Acik kalmis oturumlarin kapatilmasi (cihaz sustu). */
    staleSessionIntervalMs: envNumber('JOB_STALE_SESSION_INTERVAL_MS', 5 * 60_000),
  },

  corsOrigins: env('CORS_ORIGINS', '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type Config = typeof config;
