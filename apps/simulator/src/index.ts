/**
 * Saha simulatoru.
 *
 * Donanim gelmeden once sistemi uctan uca calistirmak icin gercege yakin bir
 * is gunu uretir ve ingest sunucusuna GERCEK protokol cerceveleri gonderir
 * (Teltonika Codec8 ve GT06). Boylece protokol cozucu, oturum motoru, geofence,
 * yakit tespiti, hakedis ve arayuz tek seferde denenebilir.
 *
 * Kullanim:
 *   npm run simulate                 # dunun tam is gununu yukler
 *   npm run simulate -- --days 3     # son 3 gunu yukler
 *   npm run simulate -- --live       # simdiden itibaren gercek zamanli yayin
 */

import { connect } from 'node:net';
import type { Socket } from 'node:net';
import {
  encodeGt06Location,
  encodeGt06Login,
  encodeGt06Status,
  encodeTeltonikaData,
  encodeTeltonikaImei,
} from '@medentry/protocols';
import type { TeltonikaRecordInput } from '@medentry/protocols';
import { destinationPoint, haversineMeters } from '@medentry/shared';
import type { LatLon } from '@medentry/shared';

const HOST = process.env['INGEST_HOST'] ?? '127.0.0.1';
const PORT_TELTONIKA = Number(process.env['PORT_TELTONIKA'] ?? 5027);
const PORT_GT06 = Number(process.env['PORT_GT06'] ?? 5023);

const SITE: LatLon = { lat: 40.91, lon: 29.21 }; // Kartal santiyesi
const DEPOT: LatLon = { lat: 40.9985, lon: 29.095 }; // Merkez depo

interface Args {
  days: number;
  live: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const daysIndex = argv.indexOf('--days');
  return {
    days: daysIndex >= 0 ? Math.max(1, Number(argv[daysIndex + 1] ?? 1)) : 1,
    live: argv.includes('--live'),
  };
}

// ---------------------------------------------------------------------------
// Yardimcilar
// ---------------------------------------------------------------------------

/** Deterministik rastgelelik: ayni tohum ayni gunu uretir. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Yerel gun basindan itibaren saat/dakika ekleyerek UTC zaman damgasi uretir.
 * `dayStartUtc` zaten yerel gece yarisinin UTC karsiligidir.
 */
function localTime(dayStartUtc: Date, hour: number, minute: number): Date {
  return new Date(dayStartUtc.getTime() + (hour * 60 + minute) * 60_000);
}

/** Gunluk (yerel) tarih etiketi - kayit ve log icin. */
function localDateLabel(dayStartUtc: Date): string {
  return new Date(dayStartUtc.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Verilen gunun 00:00 (yerel) anini UTC olarak dondurur. */
function startOfLocalDay(daysAgo: number): Date {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(utcMidnight - 3 * 3600_000 - daysAgo * 86_400_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openSocket(port: number, handshake: Buffer, label: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: HOST, port }, () => {
      socket.write(handshake);
      // El sikismaya cihaz ack'i beklenir; ingest kabul edince veri gonderilir.
      setTimeout(() => resolve(socket), 300);
    });
    socket.on('error', (error) => reject(new Error(`${label} baglanti hatasi: ${error.message}`)));
    socket.setNoDelay(true);
  });
}

// ---------------------------------------------------------------------------
// Ekskavator (Teltonika + CAN)
// ---------------------------------------------------------------------------

interface ExcavatorPlan {
  imei: string;
  base: LatLon;
  /** Gunluk yakit tuketimi (yuzde puan). */
  fuelBurnPerHour: number;
  startFuelPct: number;
  seed: number;
}

/**
 * Bir is gunu uretir:
 *   07:00 calisma basi - 12:00 ogle molasi (kontak kapali) - 13:00 devam -
 *   17:00 paydos. Arada rolanti donemleri ve bir yakit dolumu vardir.
 */
function buildExcavatorDay(plan: ExcavatorPlan, dayStart: Date): TeltonikaRecordInput[] {
  const random = makeRandom(plan.seed + dayStart.getUTCDate());
  const records: TeltonikaRecordInput[] = [];
  let fuel = plan.startFuelPct;
  let engineMinutes = 4200 + Math.floor(random() * 500);
  let odometer = 125_000;

  const pushSample = (ts: Date, ignition: boolean, rpm: number, position: LatLon): void => {
    records.push({
      timestamp: ts,
      lat: position.lat,
      lon: position.lon,
      speedKph: 0, // ekskavator: hiz her zaman sifir, is motor devrinden anlasilir
      headingDeg: Math.floor(random() * 360),
      satellites: 9 + Math.floor(random() * 4),
      altitudeM: 60,
      io1: { 239: ignition ? 1 : 0, 240: rpm > 1200 ? 1 : 0, 21: 4 },
      io2: {
        66: 27_600 + Math.floor(random() * 400), // harici voltaj (mV)
        85: rpm, // motor devri
        89: Math.round(fuel), // yakit yuzdesi
      },
      io4: { 16: Math.round(odometer), 102: engineMinutes },
    });
  };

  // Vardiya dilimleri: [baslangic, bitis, calisiyor mu]
  const segments: Array<[number, number, boolean]> = [
    [7 * 60, 9 * 60 + 30, true], // kazi
    [9 * 60 + 30, 10 * 60, false], // rolanti (cay molasi, motor acik)
    [10 * 60, 12 * 60, true], // kazi
    [13 * 60, 15 * 60 + 15, true], // kazi
    [15 * 60 + 15, 15 * 60 + 45, false], // rolanti
    [15 * 60 + 45, 17 * 60, true], // kazi
  ];

  for (const [fromMin, toMin, working] of segments) {
    for (let minute = fromMin; minute < toMin; minute += 1) {
      const ts = localTime(dayStart, 0, minute);
      const rpm = working ? 1450 + Math.floor(random() * 400) : 700 + Math.floor(random() * 80);
      // Makine kazi yaparken birkac metre oynar.
      // Duran makinede GPS sapmasi: birkac metre.
      const position = destinationPoint(plan.base, random() * 360, random() * 6);
      fuel = Math.max(5, fuel - plan.fuelBurnPerHour / 60);
      engineMinutes += 1;
      odometer += working ? 2 : 0;
      pushSample(ts, true, rpm, position);
    }
    // Dilim sonunda kontak kapanmiyorsa devam.
  }

  // Ogle molasi: 12:00'de kontak kapali kayit, 13:00'e kadar sessizlik.
  records.push({
    timestamp: localTime(dayStart, 12, 0),
    lat: plan.base.lat,
    lon: plan.base.lon,
    speedKph: 0,
    io1: { 239: 0, 240: 0 },
    io2: { 89: Math.round(fuel) },
    io4: { 102: engineMinutes },
  });

  // Paydos.
  records.push({
    timestamp: localTime(dayStart, 17, 0),
    lat: plan.base.lat,
    lon: plan.base.lon,
    speedKph: 0,
    io1: { 239: 0, 240: 0 },
    io2: { 89: Math.round(fuel) },
    io4: { 102: engineMinutes },
  });

  // Aksam yakit dolumu: kontak kapali, seviye hizla yukselir.
  const fillStart = 18 * 60;
  for (let i = 0; i < 6; i += 1) {
    fuel = Math.min(95, fuel + 9);
    records.push({
      timestamp: localTime(dayStart, 0, fillStart + i * 3),
      lat: plan.base.lat,
      lon: plan.base.lon,
      speedKph: 0,
      io1: { 239: 0, 240: 0 },
      io2: { 89: Math.round(fuel) },
    });
  }
  // Dolum sonrasi kararli seviye (tespit algoritmasi icin gerekli).
  for (let i = 0; i < 6; i += 1) {
    records.push({
      timestamp: localTime(dayStart, 0, fillStart + 20 + i * 5),
      lat: plan.base.lat,
      lon: plan.base.lon,
      speedKph: 0,
      io1: { 239: 0 },
      io2: { 89: Math.round(fuel) },
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Kamyon ve pickup (GT06)
// ---------------------------------------------------------------------------

interface DriveSample {
  timestamp: Date;
  position: LatLon;
  speedKph: number;
  headingDeg: number;
  ignition: boolean;
}

/** Iki nokta arasinda gidis-donus seferleri uretir. */
function buildTruckDay(dayStart: Date, seed: number): DriveSample[] {
  const random = makeRandom(seed + dayStart.getUTCDate());
  const samples: DriveSample[] = [];
  const legMinutes = 35;
  let minute = 7 * 60;

  for (let trip = 0; trip < 6; trip += 1) {
    const from = trip % 2 === 0 ? SITE : DEPOT;
    const to = trip % 2 === 0 ? DEPOT : SITE;

    for (let step = 0; step <= legMinutes; step += 1) {
      const ratio = step / legMinutes;
      const position: LatLon = {
        lat: from.lat + (to.lat - from.lat) * ratio,
        lon: from.lon + (to.lon - from.lon) * ratio,
      };
      samples.push({
        timestamp: localTime(dayStart, 0, minute + step),
        position,
        // Sefer basi/sonu yavas, ortada yol hizi.
        speedKph: step < 2 || step > legMinutes - 2 ? 8 : 45 + Math.floor(random() * 25),
        headingDeg: trip % 2 === 0 ? 340 : 160,
        ignition: true,
      });
    }
    minute += legMinutes;

    // Yukleme/bosaltma: 20 dk rolanti (motor acik, hiz 0).
    for (let step = 0; step < 20; step += 1) {
      samples.push({
        timestamp: localTime(dayStart, 0, minute + step),
        position: to,
        speedKph: 0,
        headingDeg: 0,
        ignition: true,
      });
    }
    minute += 20;

    // Ogle molasi: kontak kapali.
    if (trip === 2) {
      samples.push({
        timestamp: localTime(dayStart, 0, minute),
        position: to,
        speedKph: 0,
        headingDeg: 0,
        ignition: false,
      });
      minute += 60;
    }
  }

  samples.push({
    timestamp: localTime(dayStart, 0, minute),
    position: DEPOT,
    speedKph: 0,
    headingDeg: 0,
    ignition: false,
  });
  return samples;
}

/** Operator araci: sabah santiyeye gider, aksam doner. */
function buildPickupDay(dayStart: Date, seed: number): DriveSample[] {
  const random = makeRandom(seed + dayStart.getUTCDate());
  const home: LatLon = { lat: 40.96, lon: 29.12 }; // mahremiyet bolgesi icinde
  const samples: DriveSample[] = [];

  const drive = (from: LatLon, to: LatLon, startMinute: number, minutes: number): void => {
    for (let step = 0; step <= minutes; step += 1) {
      const ratio = step / minutes;
      samples.push({
        timestamp: localTime(dayStart, 0, startMinute + step),
        position: {
          lat: from.lat + (to.lat - from.lat) * ratio,
          lon: from.lon + (to.lon - from.lon) * ratio,
        },
        speedKph: step === 0 || step === minutes ? 0 : 35 + Math.floor(random() * 30),
        headingDeg: 120,
        ignition: true,
      });
    }
    samples.push({
      timestamp: localTime(dayStart, 0, startMinute + minutes + 1),
      position: to,
      speedKph: 0,
      headingDeg: 0,
      ignition: false,
    });
  };

  drive(home, SITE, 6 * 60 + 15, 30); // 06:15 evden santiyeye
  drive(SITE, home, 17 * 60 + 30, 30); // 17:30 santiyeden eve
  return samples;
}

// ---------------------------------------------------------------------------
// Gonderim
// ---------------------------------------------------------------------------

async function sendTeltonika(imei: string, records: TeltonikaRecordInput[]): Promise<void> {
  const socket = await openSocket(PORT_TELTONIKA, encodeTeltonikaImei(imei), `Teltonika ${imei}`);
  // Codec8 tek pakette birden fazla kayit tasir; 10'arli gruplar gonderilir.
  for (let i = 0; i < records.length; i += 10) {
    socket.write(encodeTeltonikaData(records.slice(i, i + 10)));
    await sleep(20);
  }
  await sleep(500);
  socket.end();
  console.log(`[sim] Teltonika ${imei}: ${records.length} kayit gonderildi`);
}

async function sendGt06(imei: string, samples: DriveSample[]): Promise<void> {
  const socket = await openSocket(PORT_GT06, encodeGt06Login(imei), `GT06 ${imei}`);
  let serial = 2;
  let odometerM = 48_000;
  let previous = samples[0]?.position;

  for (const sample of samples) {
    if (previous) {
      odometerM += haversineMeters(previous, sample.position);
    }
    previous = sample.position;
    // Gecmise donuk yuklemede kontak durumu, zaman damgasi tasiyan genis
    // konum paketiyle (0x22) gonderilir. Durum paketinde (0x13) zaman damgasi
    // olmadigi icin gecmis veri yuklerken kullanilamaz.
    socket.write(
      encodeGt06Location(
        {
          timestamp: sample.timestamp,
          lat: sample.position.lat,
          lon: sample.position.lon,
          speedKph: sample.speedKph,
          headingDeg: sample.headingDeg,
          ignition: sample.ignition,
          odometerM: Math.round(odometerM),
        },
        serial++,
      ),
    );
    if (serial % 20 === 0) await sleep(20);
  }

  await sleep(500);
  socket.end();
  console.log(`[sim] GT06 ${imei}: ${samples.length} konum gonderildi`);
}

/** Gercek zamanli yayin: her 10 saniyede bir guncel konum. */
async function runLive(): Promise<void> {
  console.log('[sim] canli mod - Ctrl+C ile durdurun');
  const teltonika = await openSocket(
    PORT_TELTONIKA,
    encodeTeltonikaImei('356307042441013'),
    'Teltonika canli',
  );
  const gt06 = await openSocket(PORT_GT06, encodeGt06Login('868120303444444'), 'GT06 canli');
  // Canli modda durum paketi gercek zamanli oldugu icin kullanilabilir.
  gt06.write(encodeGt06Status({ ignition: true }, 1));

  const random = makeRandom(42);
  let fuel = 78;
  let serial = 2;
  let truckAngle = 0;

  for (;;) {
    const now = new Date();
    const working = random() > 0.25;
    fuel = Math.max(10, fuel - 0.02);

    teltonika.write(
      encodeTeltonikaData([
        {
          timestamp: now,
          lat: SITE.lat + (random() - 0.5) * 0.0004,
          lon: SITE.lon + (random() - 0.5) * 0.0004,
          speedKph: 0,
          satellites: 10,
          io1: { 239: 1, 240: working ? 1 : 0 },
          io2: { 85: working ? 1600 : 750, 89: Math.round(fuel), 66: 27_800 },
        },
      ]),
    );

    truckAngle = (truckAngle + 12) % 360;
    const truckPos = destinationPoint(DEPOT, truckAngle, 1200);
    gt06.write(
      encodeGt06Location(
        {
          timestamp: now,
          lat: truckPos.lat,
          lon: truckPos.lon,
          speedKph: 40 + Math.floor(random() * 20),
          headingDeg: truckAngle,
          ignition: true,
        },
        serial++,
      ),
    );

    console.log(`[sim] ${now.toISOString()} yayin (yakit %${fuel.toFixed(1)})`);
    await sleep(10_000);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.live) {
    await runLive();
    return;
  }

  for (let daysAgo = args.days; daysAgo >= 1; daysAgo -= 1) {
    const dayStart = startOfLocalDay(daysAgo);
    console.log(`[sim] gun yukleniyor: ${localDateLabel(dayStart)}`);

    await sendTeltonika(
      '356307042441013',
      buildExcavatorDay(
        { imei: '356307042441013', base: SITE, fuelBurnPerHour: 4.5, startFuelPct: 86, seed: 11 },
        dayStart,
      ),
    );

    await sendTeltonika(
      '356307042441021',
      buildExcavatorDay(
        {
          imei: '356307042441021',
          base: destinationPoint(SITE, 90, 200),
          fuelBurnPerHour: 5.2,
          startFuelPct: 72,
          seed: 23,
        },
        dayStart,
      ),
    );

    await sendGt06('868120303444444', buildTruckDay(dayStart, 31));
    await sendGt06('868120303444555', buildPickupDay(dayStart, 47));
  }

  console.log('[sim] tamamlandi. Hakedis hesabi icin API rollup isini bekleyin veya');
  console.log('[sim] POST /api/billing/recompute cagirin.');
  await sleep(1500);
  process.exit(0);
}

main().catch((error) => {
  console.error('[sim] hata:', error);
  process.exit(1);
});
