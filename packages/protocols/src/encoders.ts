/**
 * Cihaz tarafi paket ureticileri.
 *
 * Yalnizca test ve saha simulasyonu icindir: gercek donanim gelmeden once
 * ingest sunucusunu, oturum motorunu ve arayuzu uctan uca calistirabilmek
 * gerekir. Uretimde cihazlar bu paketleri kendileri uretir.
 */

import { crc16Arc, crcItu, stringToBcd } from './checksum.js';
import { GT06_PROTOCOL } from './gt06.js';

// ---------------------------------------------------------------------------
// GT06
// ---------------------------------------------------------------------------

function gt06Frame(protocolNo: number, content: Buffer, serial: number): Buffer {
  const length = 1 + content.length + 2 + 2; // protokol + icerik + seri + crc
  const body = Buffer.concat([
    Buffer.from([length, protocolNo]),
    content,
    Buffer.from([(serial >> 8) & 0xff, serial & 0xff]),
  ]);
  const crc = crcItu(body);
  return Buffer.concat([
    Buffer.from([0x78, 0x78]),
    body,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a]),
  ]);
}

export function encodeGt06Login(imei: string, serial = 1): Buffer {
  const content = Buffer.concat([stringToBcd(imei, 8), Buffer.from([0x00, 0x36])]);
  return gt06Frame(GT06_PROTOCOL.LOGIN, content, serial);
}

export interface Gt06LocationInput {
  timestamp: Date;
  lat: number;
  lon: number;
  speedKph: number;
  headingDeg: number;
  satellites?: number;
  gpsValid?: boolean;
}

function gt06GpsBlock(input: Gt06LocationInput): Buffer {
  const d = input.timestamp;
  const buf = Buffer.alloc(18);
  buf.writeUInt8(d.getUTCFullYear() - 2000, 0);
  buf.writeUInt8(d.getUTCMonth() + 1, 1);
  buf.writeUInt8(d.getUTCDate(), 2);
  buf.writeUInt8(d.getUTCHours(), 3);
  buf.writeUInt8(d.getUTCMinutes(), 4);
  buf.writeUInt8(d.getUTCSeconds(), 5);
  const sats = Math.min(15, input.satellites ?? 10);
  buf.writeUInt8(0xc0 | sats, 6); // uzunluk (yuksek nibble) + uydu sayisi
  buf.writeUInt32BE(Math.round(Math.abs(input.lat) * 1_800_000), 7);
  buf.writeUInt32BE(Math.round(Math.abs(input.lon) * 1_800_000), 11);
  buf.writeUInt8(Math.min(255, Math.round(input.speedKph)), 15);

  let status = Math.round(input.headingDeg) & 0x03ff;
  if (input.gpsValid !== false) status |= 0x1000;
  if (input.lat >= 0) status |= 0x0400; // kuzey
  if (input.lon < 0) status |= 0x0800; // bati
  buf.writeUInt16BE(status, 16);
  return buf;
}

export function encodeGt06Location(input: Gt06LocationInput, serial = 2): Buffer {
  return gt06Frame(GT06_PROTOCOL.LOCATION, gt06GpsBlock(input), serial);
}

export function encodeGt06Status(
  options: { ignition: boolean; voltageLevel?: number; gsmSignal?: number },
  serial = 3,
): Buffer {
  const terminalInfo = (options.ignition ? 0x02 : 0x00) | 0x40;
  const content = Buffer.from([
    terminalInfo,
    options.voltageLevel ?? 5,
    options.gsmSignal ?? 4,
    0x00,
    0x01,
  ]);
  return gt06Frame(GT06_PROTOCOL.STATUS, content, serial);
}

// ---------------------------------------------------------------------------
// Teltonika Codec8
// ---------------------------------------------------------------------------

export function encodeTeltonikaImei(imei: string): Buffer {
  const ascii = Buffer.from(imei, 'ascii');
  const out = Buffer.alloc(2 + ascii.length);
  out.writeUInt16BE(ascii.length, 0);
  ascii.copy(out, 2);
  return out;
}

export interface TeltonikaRecordInput {
  timestamp: Date;
  lat: number;
  lon: number;
  altitudeM?: number;
  headingDeg?: number;
  satellites?: number;
  speedKph?: number;
  /** IO id -> deger (ham, cihaz biriminde). */
  io1?: Record<number, number>;
  io2?: Record<number, number>;
  io4?: Record<number, number>;
  io8?: Record<number, bigint>;
  eventIoId?: number;
}

export function encodeTeltonikaData(records: readonly TeltonikaRecordInput[]): Buffer {
  const chunks: Buffer[] = [];
  for (const r of records) {
    const gps = Buffer.alloc(24);
    gps.writeBigUInt64BE(BigInt(r.timestamp.getTime()), 0);
    gps.writeUInt8(1, 8); // oncelik
    gps.writeInt32BE(Math.round(r.lon * 1e7), 9);
    gps.writeInt32BE(Math.round(r.lat * 1e7), 13);
    gps.writeInt16BE(Math.round(r.altitudeM ?? 0), 17);
    gps.writeUInt16BE(Math.round(r.headingDeg ?? 0), 19);
    gps.writeUInt8(r.satellites ?? 10, 21);
    gps.writeUInt16BE(Math.round(r.speedKph ?? 0), 22);

    const io1 = r.io1 ?? {};
    const io2 = r.io2 ?? {};
    const io4 = r.io4 ?? {};
    const io8 = r.io8 ?? {};
    const totalIo = Object.keys(io1).length + Object.keys(io2).length + Object.keys(io4).length + Object.keys(io8).length;

    const parts: Buffer[] = [Buffer.from([r.eventIoId ?? 0, totalIo])];

    parts.push(Buffer.from([Object.keys(io1).length]));
    for (const [id, value] of Object.entries(io1)) parts.push(Buffer.from([Number(id), value & 0xff]));

    parts.push(Buffer.from([Object.keys(io2).length]));
    for (const [id, value] of Object.entries(io2)) {
      const b = Buffer.alloc(3);
      b.writeUInt8(Number(id), 0);
      b.writeUInt16BE(value & 0xffff, 1);
      parts.push(b);
    }

    parts.push(Buffer.from([Object.keys(io4).length]));
    for (const [id, value] of Object.entries(io4)) {
      const b = Buffer.alloc(5);
      b.writeUInt8(Number(id), 0);
      b.writeUInt32BE(value >>> 0, 1);
      parts.push(b);
    }

    parts.push(Buffer.from([Object.keys(io8).length]));
    for (const [id, value] of Object.entries(io8)) {
      const b = Buffer.alloc(9);
      b.writeUInt8(Number(id), 0);
      b.writeBigUInt64BE(value, 1);
      parts.push(b);
    }

    chunks.push(Buffer.concat([gps, ...parts]));
  }

  const dataField = Buffer.concat([
    Buffer.from([0x08, records.length]),
    ...chunks,
    Buffer.from([records.length]),
  ]);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(0, 0);
  header.writeUInt32BE(dataField.length, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc16Arc(dataField), 0);
  return Buffer.concat([header, dataField, crc]);
}
