/**
 * GT06 / GT06N protokolu (Concox ve muadili 4G takip cihazlari).
 *
 * Cerceve yapisi:
 *   7878 | uzunluk(1) | protokol(1) | icerik | seri(2) | crc(2) | 0D0A
 *   7979 | uzunluk(2) | protokol(1) | icerik | seri(2) | crc(2) | 0D0A
 *
 * CRC, uzunluk baytindan seri numarasinin sonuna kadar olan bolum uzerinden
 * CRC-ITU ile hesaplanir. Sunucu login ve heartbeat paketlerini ack'lemezse
 * cihaz baglantiyi kapatir; bu yuzden ack uretimi zorunludur.
 */

import type { AlarmCode, NormalizedRecord } from '@medentry/shared';
import { bcdToString, crcItu } from './checksum.js';
import type { DecodedMessage, DecodeResult, DecoderSession, ProtocolDecoder } from './types.js';

const START_1 = 0x7878;
const START_2 = 0x7979;

export const GT06_PROTOCOL = {
  LOGIN: 0x01,
  LOCATION: 0x12,
  STATUS: 0x13,
  STRING: 0x15,
  ALARM: 0x16,
  GPS_LBS: 0x22,
  GPS_LBS_STATUS: 0x26,
  LBS_MULTIPLE: 0x28,
  TIME_SYNC: 0x8a,
  INFO: 0x94,
} as const;

/** GT06 alarm baytinin platform alarm kodlarina eslenmesi. */
const ALARM_MAP: Record<number, AlarmCode> = {
  0x01: 'sos',
  0x02: 'power_cut',
  0x03: 'vibration',
  0x04: 'geofence_in',
  0x05: 'geofence_out',
  0x06: 'overspeed',
  0x09: 'vibration',
  0x0e: 'low_battery',
  0x0f: 'low_battery',
  0x11: 'power_cut',
  0x13: 'tow',
  0x14: 'jamming',
};

export class Gt06Decoder implements ProtocolDecoder {
  readonly name = 'gt06' as const;
  readonly defaultPort = 5023;

  decode(buffer: Buffer, session: DecoderSession): DecodeResult {
    const messages: DecodedMessage[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      const startIndex = findStart(buffer, offset);
      if (startIndex < 0) {
        // Baslangic isareti yok: son bayti sakla (yarim 0x78 olabilir).
        return { messages, rest: buffer.subarray(Math.max(offset, buffer.length - 1)) };
      }
      if (startIndex + 4 > buffer.length) {
        return { messages, rest: buffer.subarray(startIndex) };
      }

      const marker = buffer.readUInt16BE(startIndex);
      const lengthSize = marker === START_2 ? 2 : 1;
      const contentLength =
        lengthSize === 1 ? buffer.readUInt8(startIndex + 2) : buffer.readUInt16BE(startIndex + 2);
      // toplam = baslangic(2) + uzunluk alani + icerik(contentLength) + bitis(2)
      const frameLength = 2 + lengthSize + contentLength + 2;
      if (startIndex + frameLength > buffer.length) {
        return { messages, rest: buffer.subarray(startIndex) };
      }

      const frame = buffer.subarray(startIndex, startIndex + frameLength);
      offset = startIndex + frameLength;

      const message = this.decodeFrame(frame, lengthSize, contentLength, session);
      if (message) messages.push(message);
    }

    return { messages, rest: Buffer.alloc(0) };
  }

  private decodeFrame(
    frame: Buffer,
    lengthSize: number,
    contentLength: number,
    session: DecoderSession,
  ): DecodedMessage | null {
    const bodyStart = 2 + lengthSize;
    // CRC alani: uzunluk baytindan seri numarasinin sonuna kadar.
    const crcStart = 2;
    const crcEnd = frame.length - 4; // crc(2) + stop(2)
    const expected = frame.readUInt16BE(crcEnd);
    const actual = crcItu(frame.subarray(crcStart, crcEnd));
    if (expected !== actual) {
      return { kind: 'unknown', meta: { error: 'crc_mismatch', expected, actual } };
    }

    const protocolNo = frame.readUInt8(bodyStart);
    const serial = frame.readUInt16BE(crcEnd - 2);
    const body = frame.subarray(bodyStart + 1, crcEnd - 2);

    switch (protocolNo) {
      case GT06_PROTOCOL.LOGIN: {
        // Terminal ID: 8 bayt BCD, basindaki sifirlar IMEI'yi 15 haneye tamamlar.
        const imei = bcdToString(body.subarray(0, 8)).replace(/^0+/, '');
        session.deviceIdent = imei;
        return {
          kind: 'login',
          deviceIdent: imei,
          ack: buildAck(protocolNo, serial),
          meta: { typeCode: body.length >= 10 ? body.readUInt16BE(8) : undefined },
        };
      }

      case GT06_PROTOCOL.LOCATION:
      case GT06_PROTOCOL.GPS_LBS: {
        const record = parseLocation(body, session);
        return record
          ? { kind: 'position', deviceIdent: session.deviceIdent as string | undefined, record }
          : { kind: 'unknown', meta: { protocolNo } };
      }

      case GT06_PROTOCOL.STATUS: {
        const record = parseStatus(body, session);
        return {
          kind: 'heartbeat',
          deviceIdent: session.deviceIdent as string | undefined,
          record: record ?? undefined,
          ack: buildAck(protocolNo, serial),
        };
      }

      case GT06_PROTOCOL.ALARM:
      case GT06_PROTOCOL.GPS_LBS_STATUS: {
        const record = parseAlarm(body, session);
        return {
          kind: 'alarm',
          deviceIdent: session.deviceIdent as string | undefined,
          record: record ?? undefined,
          ack: buildAck(protocolNo, serial),
        };
      }

      case GT06_PROTOCOL.TIME_SYNC:
        return { kind: 'response', ack: buildTimeSync(serial) };

      case GT06_PROTOCOL.INFO: {
        // Bilgi aktarimi: 0x00 harici voltaj, 0x04 durum bilgisi vb.
        const infoType = body.length > 0 ? body.readUInt8(0) : -1;
        const meta: Record<string, unknown> = { infoType };
        if (infoType === 0x00 && body.length >= 3) {
          meta['externalV'] = body.readUInt16BE(1) / 100;
        }
        return { kind: 'status', deviceIdent: session.deviceIdent as string | undefined, meta };
      }

      default:
        return { kind: 'unknown', meta: { protocolNo } };
    }
  }
}

function findStart(buffer: Buffer, from: number): number {
  for (let i = from; i < buffer.length - 1; i += 1) {
    const marker = buffer.readUInt16BE(i);
    if (marker === START_1 || marker === START_2) return i;
  }
  return -1;
}

/** Sunucu ack cercevesi: 7878 05 <protokol> <seri> <crc> 0D0A */
export function buildAck(protocolNo: number, serial: number): Buffer {
  const body = Buffer.alloc(4);
  body.writeUInt8(0x05, 0);
  body.writeUInt8(protocolNo, 1);
  body.writeUInt16BE(serial, 2);
  const crc = crcItu(body);
  return Buffer.concat([
    Buffer.from([0x78, 0x78]),
    body,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a]),
  ]);
}

/** 0x8A zaman senkron yanitina UTC zaman damgasi eklenir. */
export function buildTimeSync(serial: number, now: Date = new Date()): Buffer {
  const time = Buffer.from([
    now.getUTCFullYear() - 2000,
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]);
  const body = Buffer.concat([
    Buffer.from([0x0b, GT06_PROTOCOL.TIME_SYNC]),
    time,
    Buffer.from([(serial >> 8) & 0xff, serial & 0xff]),
  ]);
  const crc = crcItu(body);
  return Buffer.concat([
    Buffer.from([0x78, 0x78]),
    body,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a]),
  ]);
}

interface GpsBlock {
  timestamp: Date;
  lat: number;
  lon: number;
  speedKph: number;
  headingDeg: number;
  satellites: number;
  gpsValid: boolean;
  bytesRead: number;
}

/** Ortak GPS blogu: tarih(6) + uydu(1) + enlem(4) + boylam(4) + hiz(1) + durum(2) */
function parseGpsBlock(body: Buffer): GpsBlock | null {
  if (body.length < 18) return null;
  const timestamp = new Date(
    Date.UTC(
      2000 + body.readUInt8(0),
      body.readUInt8(1) - 1,
      body.readUInt8(2),
      body.readUInt8(3),
      body.readUInt8(4),
      body.readUInt8(5),
    ),
  );
  const satellites = body.readUInt8(6) & 0x0f;
  // Ham deger: derece * 60 * 30000
  let lat = body.readUInt32BE(7) / 1_800_000;
  let lon = body.readUInt32BE(11) / 1_800_000;
  const speedKph = body.readUInt8(15);
  const status = body.readUInt16BE(16);

  const gpsValid = (status & 0x1000) !== 0;
  if ((status & 0x0400) === 0) lat = -lat; // bit10: 1 = kuzey
  if ((status & 0x0800) !== 0) lon = -lon; // bit11: 1 = bati
  const headingDeg = status & 0x03ff;

  return { timestamp, lat, lon, speedKph, headingDeg, satellites, gpsValid, bytesRead: 18 };
}

function parseLocation(body: Buffer, session: DecoderSession): NormalizedRecord | null {
  const gps = parseGpsBlock(body);
  if (!gps) return null;
  const record: NormalizedRecord = {
    deviceIdent: (session.deviceIdent as string) ?? '',
    protocol: 'gt06',
    timestamp: gps.timestamp,
    position: { lat: gps.lat, lon: gps.lon },
    gpsValid: gps.gpsValid,
    speedKph: gps.speedKph,
    headingDeg: gps.headingDeg,
    satellites: gps.satellites,
    raw: { hex: body.toString('hex') },
  };
  // GT06N konum paketinin sonunda ACC baytı bulunabilir (uzunluga gore).
  if (body.length >= 31) {
    const acc = body.readUInt8(body.length - 5);
    if (acc === 0x00 || acc === 0x01) record.ignition = acc === 0x01;
  }
  return record;
}

function parseStatus(body: Buffer, session: DecoderSession): NormalizedRecord | null {
  if (body.length < 3) return null;
  const terminalInfo = body.readUInt8(0);
  const voltageLevel = body.readUInt8(1);
  const gsmSignal = body.readUInt8(2);

  return {
    deviceIdent: (session.deviceIdent as string) ?? '',
    protocol: 'gt06',
    timestamp: new Date(),
    gpsValid: false,
    ignition: (terminalInfo & 0x02) !== 0, // bit1: ACC yuksek
    gsmSignal,
    // Cihaz 0-6 arasi kademe bildirir; yaklasik gerilime cevrilir.
    batteryV: Math.round((3.4 + voltageLevel * 0.15) * 100) / 100,
    alarms: mapTerminalAlarm((terminalInfo >> 3) & 0x07),
    raw: { terminalInfo, voltageLevel, gsmSignal },
  };
}

function parseAlarm(body: Buffer, session: DecoderSession): NormalizedRecord | null {
  const gps = parseGpsBlock(body);
  if (!gps) return null;
  // GPS blogundan sonra LBS bilgisi (degisken) ve durum baytlari gelir.
  const tail = body.subarray(gps.bytesRead);
  const record: NormalizedRecord = {
    deviceIdent: (session.deviceIdent as string) ?? '',
    protocol: 'gt06',
    timestamp: gps.timestamp,
    position: { lat: gps.lat, lon: gps.lon },
    gpsValid: gps.gpsValid,
    speedKph: gps.speedKph,
    headingDeg: gps.headingDeg,
    satellites: gps.satellites,
    raw: { hex: body.toString('hex') },
  };

  // Alarm baytı paketin sonuna yakin yer alir (dil baytlarindan once).
  if (tail.length >= 5) {
    const terminalInfo = tail[tail.length - 5]!;
    const alarmByte = tail[tail.length - 3]!;
    record.ignition = (terminalInfo & 0x02) !== 0;
    const mapped = ALARM_MAP[alarmByte];
    record.alarms = [mapped ?? 'unknown'];
  }
  return record;
}

function mapTerminalAlarm(code: number): AlarmCode[] {
  switch (code) {
    case 1:
      return ['vibration'];
    case 2:
      return ['power_cut'];
    case 3:
      return ['low_battery'];
    case 4:
      return ['sos'];
    default:
      return [];
  }
}

export const gt06 = new Gt06Decoder();
