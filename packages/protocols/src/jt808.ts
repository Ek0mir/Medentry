/**
 * JT/T 808 (konum) + JT/T 1078 (video) protokolu.
 *
 * 4G MDVR / kamerali arac terminallerinin buyuk cogunlugu bu protokolu
 * konusur. Platformumuzda iki ise yarar:
 *   1) Konum/kontak/yakit telemetrisi (0x0200 mesaji)
 *   2) Kamera kontrolu: canli yayin baslatma (0x9101), SD karttaki kaydin
 *      geri oynatilmasi (0x9201), SD kayit listesinin sorgulanmasi (0x9205)
 *      ve kayit dosyasinin sunucuya yuklenmesi (0x9206).
 *
 * Cerceve: 7E | baslik | govde | XOR saglama | 7E
 * Kacis (escape): 0x7D -> 7D 01, 0x7E -> 7D 02
 */

import type { NormalizedRecord } from '@medentry/shared';
import { bcdToString, stringToBcd, xorChecksum } from './checksum.js';
import type { DecodedMessage, DecodeResult, DecoderSession, ProtocolDecoder } from './types.js';

const FLAG = 0x7e;

export const JT_MSG = {
  TERMINAL_GENERAL_RESPONSE: 0x0001,
  PLATFORM_GENERAL_RESPONSE: 0x8001,
  HEARTBEAT: 0x0002,
  REGISTER: 0x0100,
  REGISTER_RESPONSE: 0x8100,
  LOGOUT: 0x0003,
  AUTH: 0x0102,
  LOCATION: 0x0200,
  LOCATION_BATCH: 0x0704,
  // --- JT/T 1078 video ---
  LIVE_REQUEST: 0x9101,
  LIVE_CONTROL: 0x9102,
  PLAYBACK_REQUEST: 0x9201,
  PLAYBACK_CONTROL: 0x9202,
  RESOURCE_QUERY: 0x9205,
  RESOURCE_LIST: 0x1205,
  FILE_UPLOAD: 0x9206,
  FILE_UPLOAD_RESPONSE: 0x1206,
} as const;

export interface Jt808Options {
  /**
   * Cihazin zaman damgasi yerel saattir. Cin menseli terminaller fabrika
   * ayarinda UTC+8 gonderir; devreye almada dogrulanip ayarlanmalidir.
   */
  deviceUtcOffsetMinutes?: number;
}

export interface Jt808Header {
  msgId: number;
  bodyLength: number;
  encrypted: boolean;
  subpackage: boolean;
  version2019: boolean;
  terminalPhone: string;
  serial: number;
  headerLength: number;
}

export class Jt808Decoder implements ProtocolDecoder {
  readonly name = 'jt808' as const;
  readonly defaultPort = 7611;
  private readonly offsetMinutes: number;

  constructor(options: Jt808Options = {}) {
    this.offsetMinutes = options.deviceUtcOffsetMinutes ?? 480; // UTC+8
  }

  decode(buffer: Buffer, session: DecoderSession): DecodeResult {
    const messages: DecodedMessage[] = [];
    let cursor = 0;

    while (cursor < buffer.length) {
      const start = buffer.indexOf(FLAG, cursor);
      if (start < 0) return { messages, rest: Buffer.alloc(0) };
      const end = buffer.indexOf(FLAG, start + 1);
      if (end < 0) return { messages, rest: buffer.subarray(start) };

      const frame = buffer.subarray(start + 1, end);
      cursor = end + 1;
      if (frame.length < 12) continue;

      try {
        const message = this.decodeFrame(unescapeFrame(frame), session);
        if (message) messages.push(message);
      } catch (error) {
        messages.push({
          kind: 'unknown',
          meta: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    return { messages, rest: Buffer.alloc(0) };
  }

  private decodeFrame(frame: Buffer, session: DecoderSession): DecodedMessage | null {
    const checksum = frame[frame.length - 1]!;
    const payload = frame.subarray(0, frame.length - 1);
    if (xorChecksum(payload) !== checksum) {
      return { kind: 'unknown', meta: { error: 'checksum_mismatch' } };
    }

    const header = parseHeader(payload);
    const body = payload.subarray(header.headerLength, header.headerLength + header.bodyLength);
    session.deviceIdent = header.terminalPhone;
    session['version2019'] = header.version2019;

    switch (header.msgId) {
      case JT_MSG.REGISTER: {
        const authCode = header.terminalPhone;
        return {
          kind: 'login',
          deviceIdent: header.terminalPhone,
          ack: buildRegisterResponse(header, 0, authCode),
          meta: { authCode },
        };
      }
      case JT_MSG.AUTH:
        return {
          kind: 'login',
          deviceIdent: header.terminalPhone,
          ack: buildGeneralResponse(header, 0),
        };
      case JT_MSG.HEARTBEAT:
        return {
          kind: 'heartbeat',
          deviceIdent: header.terminalPhone,
          ack: buildGeneralResponse(header, 0),
        };
      case JT_MSG.LOCATION: {
        const record = this.parseLocation(body, header.terminalPhone);
        return {
          kind: 'position',
          deviceIdent: header.terminalPhone,
          record: record ?? undefined,
          ack: buildGeneralResponse(header, 0),
        };
      }
      case JT_MSG.LOCATION_BATCH: {
        // Toplu konum: sayi(2) + tur(1) + [uzunluk(2) + konum govdesi] ...
        const records: NormalizedRecord[] = [];
        let offset = 3;
        const count = body.readUInt16BE(0);
        for (let i = 0; i < count && offset + 2 <= body.length; i += 1) {
          const len = body.readUInt16BE(offset);
          offset += 2;
          const rec = this.parseLocation(body.subarray(offset, offset + len), header.terminalPhone);
          if (rec) records.push(rec);
          offset += len;
        }
        return {
          kind: 'position',
          deviceIdent: header.terminalPhone,
          record: records[0],
          ack: buildGeneralResponse(header, 0),
          meta: { records },
        };
      }
      case JT_MSG.RESOURCE_LIST:
        return {
          kind: 'media',
          deviceIdent: header.terminalPhone,
          meta: { resources: parseResourceList(body, this.offsetMinutes) },
          ack: buildGeneralResponse(header, 0),
        };
      case JT_MSG.TERMINAL_GENERAL_RESPONSE:
        return {
          kind: 'response',
          deviceIdent: header.terminalPhone,
          meta: {
            replySerial: body.readUInt16BE(0),
            replyMsgId: body.readUInt16BE(2),
            result: body.readUInt8(4),
          },
        };
      default:
        return {
          kind: 'unknown',
          deviceIdent: header.terminalPhone,
          ack: buildGeneralResponse(header, 0),
          meta: { msgId: header.msgId },
        };
    }
  }

  private parseLocation(body: Buffer, terminalPhone: string): NormalizedRecord | null {
    if (body.length < 28) return null;
    const alarm = body.readUInt32BE(0);
    const status = body.readUInt32BE(4);
    let lat = body.readUInt32BE(8) / 1e6;
    let lon = body.readUInt32BE(12) / 1e6;
    const altitude = body.readUInt16BE(16);
    const speed = body.readUInt16BE(18) / 10;
    const direction = body.readUInt16BE(20);
    const timeBcd = bcdToString(body.subarray(22, 28));

    if ((status & 0x04) !== 0) lat = -lat; // guney enlem
    if ((status & 0x08) !== 0) lon = -lon; // bati boylam

    const record: NormalizedRecord = {
      deviceIdent: terminalPhone,
      protocol: 'jt808',
      timestamp: parseBcdTime(timeBcd, this.offsetMinutes),
      position: { lat, lon },
      gpsValid: (status & 0x02) !== 0,
      speedKph: speed,
      headingDeg: direction,
      altitudeM: altitude,
      ignition: (status & 0x01) !== 0, // bit0: ACC
      raw: { alarm, status },
    };

    // Ek bilgi alanlari (TLV)
    let offset = 28;
    while (offset + 2 <= body.length) {
      const id = body.readUInt8(offset);
      const len = body.readUInt8(offset + 1);
      const value = body.subarray(offset + 2, offset + 2 + len);
      offset += 2 + len;
      if (value.length < len) break;
      switch (id) {
        case 0x01:
          if (len >= 4) record.odometerM = value.readUInt32BE(0) * 100; // 0.1 km -> m
          break;
        case 0x02:
          if (len >= 2) record.fuelLevelLiters = value.readUInt16BE(0) / 10;
          break;
        case 0x30:
          if (len >= 1) record.gsmSignal = value.readUInt8(0);
          break;
        case 0x31:
          if (len >= 1) record.satellites = value.readUInt8(0);
          break;
        default:
          break;
      }
    }

    record.alarms = mapJtAlarms(alarm);
    return record;
  }
}

function mapJtAlarms(alarm: number): NormalizedRecord['alarms'] {
  const out: NonNullable<NormalizedRecord['alarms']> = [];
  if (alarm & 0x01) out.push('sos');
  if (alarm & 0x02) out.push('overspeed');
  if (alarm & (1 << 7)) out.push('low_battery');
  if (alarm & (1 << 8)) out.push('power_cut');
  if (alarm & (1 << 20)) out.push('crash');
  return out;
}

export function parseHeader(payload: Buffer): Jt808Header {
  const msgId = payload.readUInt16BE(0);
  const attr = payload.readUInt16BE(2);
  const bodyLength = attr & 0x03ff;
  const encrypted = ((attr >> 10) & 0x07) !== 0;
  const subpackage = (attr & 0x2000) !== 0;
  const version2019 = (attr & 0x4000) !== 0;

  let offset = 4;
  if (version2019) offset += 1; // protokol surumu
  const phoneBytes = version2019 ? 10 : 6;
  const terminalPhone = bcdToString(payload.subarray(offset, offset + phoneBytes)).replace(/^0+/, '');
  offset += phoneBytes;
  const serial = payload.readUInt16BE(offset);
  offset += 2;
  if (subpackage) offset += 4;

  return { msgId, bodyLength, encrypted, subpackage, version2019, terminalPhone, serial, headerLength: offset };
}

/** 7D/7E kacis cozumu. */
export function unescapeFrame(frame: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < frame.length; i += 1) {
    const byte = frame[i]!;
    if (byte === 0x7d && i + 1 < frame.length) {
      const next = frame[i + 1]!;
      if (next === 0x01) {
        out.push(0x7d);
        i += 1;
        continue;
      }
      if (next === 0x02) {
        out.push(0x7e);
        i += 1;
        continue;
      }
    }
    out.push(byte);
  }
  return Buffer.from(out);
}

/** 7D/7E kacis uygulama. */
export function escapeFrame(payload: Buffer): Buffer {
  const out: number[] = [];
  for (const byte of payload) {
    if (byte === 0x7d) out.push(0x7d, 0x01);
    else if (byte === 0x7e) out.push(0x7d, 0x02);
    else out.push(byte);
  }
  return Buffer.from(out);
}

let serialCounter = 1;
function nextSerial(): number {
  serialCounter = (serialCounter + 1) & 0xffff;
  return serialCounter;
}

/** Sunucudan cihaza mesaj cercevesi uretir. */
export function buildMessage(
  msgId: number,
  terminalPhone: string,
  body: Buffer,
  options: { version2019?: boolean; serial?: number } = {},
): Buffer {
  const version2019 = options.version2019 ?? false;
  const attr = (body.length & 0x03ff) | (version2019 ? 0x4000 : 0);
  const parts: Buffer[] = [];

  const head = Buffer.alloc(4);
  head.writeUInt16BE(msgId, 0);
  head.writeUInt16BE(attr, 2);
  parts.push(head);

  if (version2019) parts.push(Buffer.from([0x01]));
  parts.push(stringToBcd(terminalPhone, version2019 ? 10 : 6));

  const serialBuf = Buffer.alloc(2);
  serialBuf.writeUInt16BE(options.serial ?? nextSerial(), 0);
  parts.push(serialBuf, body);

  const payload = Buffer.concat(parts);
  const checksum = Buffer.from([xorChecksum(payload)]);
  return Buffer.concat([
    Buffer.from([FLAG]),
    escapeFrame(Buffer.concat([payload, checksum])),
    Buffer.from([FLAG]),
  ]);
}

/** 0x8001 platform genel yaniti. */
export function buildGeneralResponse(header: Jt808Header, result: number): Buffer {
  const body = Buffer.alloc(5);
  body.writeUInt16BE(header.serial, 0);
  body.writeUInt16BE(header.msgId, 2);
  body.writeUInt8(result, 4);
  return buildMessage(JT_MSG.PLATFORM_GENERAL_RESPONSE, header.terminalPhone, body, {
    version2019: header.version2019,
  });
}

/** 0x8100 kayit yaniti. */
export function buildRegisterResponse(header: Jt808Header, result: number, authCode: string): Buffer {
  const auth = Buffer.from(authCode, 'ascii');
  const body = Buffer.alloc(3 + auth.length);
  body.writeUInt16BE(header.serial, 0);
  body.writeUInt8(result, 2);
  auth.copy(body, 3);
  return buildMessage(JT_MSG.REGISTER_RESPONSE, header.terminalPhone, body, {
    version2019: header.version2019,
  });
}

// ---------------------------------------------------------------------------
// JT/T 1078 - video komutlari
// ---------------------------------------------------------------------------

export type VideoDataType = 'av' | 'video' | 'talk' | 'listen' | 'broadcast';
export type StreamType = 'main' | 'sub';

const DATA_TYPE_CODE: Record<VideoDataType, number> = {
  av: 0,
  video: 1,
  talk: 2,
  listen: 3,
  broadcast: 4,
};

export interface LiveRequestParams {
  terminalPhone: string;
  /** Medya sunucusunun cihaz tarafindan erisilebilir adresi. */
  serverIp: string;
  tcpPort: number;
  udpPort?: number;
  /** Kanal numarasi (kamera). */
  channel: number;
  dataType?: VideoDataType;
  streamType?: StreamType;
  version2019?: boolean;
}

/**
 * 0x9101 - Canli yayin baslatma.
 * Cihaz, belirtilen medya sunucusuna RTP akisi acar.
 *
 * KVKK notu: Bu komut yalnizca erisim politikasi (evaluateAccess) onay
 * verdiginde ve denetim kaydi yazildiktan sonra gonderilmelidir.
 */
export function buildLiveRequest(params: LiveRequestParams): Buffer {
  const ip = Buffer.from(params.serverIp, 'ascii');
  const body = Buffer.alloc(1 + ip.length + 2 + 2 + 3);
  let offset = 0;
  body.writeUInt8(ip.length, offset);
  offset += 1;
  ip.copy(body, offset);
  offset += ip.length;
  body.writeUInt16BE(params.tcpPort, offset);
  offset += 2;
  body.writeUInt16BE(params.udpPort ?? 0, offset);
  offset += 2;
  body.writeUInt8(params.channel, offset);
  offset += 1;
  body.writeUInt8(DATA_TYPE_CODE[params.dataType ?? 'video'], offset);
  offset += 1;
  body.writeUInt8(params.streamType === 'sub' ? 1 : 0, offset);

  return buildMessage(JT_MSG.LIVE_REQUEST, params.terminalPhone, body, {
    version2019: params.version2019,
  });
}

/** 0x9102 - Canli yayin kontrolu (durdur / akis degistir / duraklat). */
export function buildLiveControl(
  terminalPhone: string,
  channel: number,
  control: 0 | 1 | 2 | 3 | 4,
  closeType: 0 | 1 | 2 = 0,
  streamType: StreamType = 'main',
  version2019 = false,
): Buffer {
  const body = Buffer.from([channel, control, closeType, streamType === 'sub' ? 1 : 0]);
  return buildMessage(JT_MSG.LIVE_CONTROL, terminalPhone, body, { version2019 });
}

export interface PlaybackParams {
  terminalPhone: string;
  serverIp: string;
  tcpPort: number;
  udpPort?: number;
  channel: number;
  /** 0: ses+video, 1: video, 2: ses, 3: video veya ses */
  mediaType?: 0 | 1 | 2 | 3;
  streamType?: StreamType;
  /** 0: tumu, 1: ana bellek (SD), 2: yedek bellek */
  storageType?: 0 | 1 | 2;
  /** 0: normal, 1: hizli ileri, 2: anahtar kare geri, 3: kare kare, 4: anahtar kare */
  playbackMode?: 0 | 1 | 2 | 3 | 4;
  /** Hiz katsayisi (0:gecersiz, 1:1x, 2:2x, 3:4x, 4:8x, 5:16x) */
  speed?: number;
  startTime: Date;
  endTime: Date;
  deviceUtcOffsetMinutes?: number;
  version2019?: boolean;
}

/**
 * 0x9201 - SD karttaki kaydin geri oynatilmasi.
 * Telefondan "olay anini izle" dendiginde bu komut uretilir.
 */
export function buildPlaybackRequest(params: PlaybackParams): Buffer {
  const ip = Buffer.from(params.serverIp, 'ascii');
  const offsetMin = params.deviceUtcOffsetMinutes ?? 480;
  const body = Buffer.alloc(1 + ip.length + 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1 + 6 + 6);
  let offset = 0;
  body.writeUInt8(ip.length, offset);
  offset += 1;
  ip.copy(body, offset);
  offset += ip.length;
  body.writeUInt16BE(params.tcpPort, offset);
  offset += 2;
  body.writeUInt16BE(params.udpPort ?? 0, offset);
  offset += 2;
  body.writeUInt8(params.channel, offset);
  offset += 1;
  body.writeUInt8(params.mediaType ?? 1, offset);
  offset += 1;
  body.writeUInt8(params.streamType === 'sub' ? 1 : 0, offset);
  offset += 1;
  body.writeUInt8(params.storageType ?? 0, offset);
  offset += 1;
  body.writeUInt8(params.playbackMode ?? 0, offset);
  offset += 1;
  body.writeUInt8(params.speed ?? 0, offset);
  offset += 1;
  toBcdTime(params.startTime, offsetMin).copy(body, offset);
  offset += 6;
  toBcdTime(params.endTime, offsetMin).copy(body, offset);

  return buildMessage(JT_MSG.PLAYBACK_REQUEST, params.terminalPhone, body, {
    version2019: params.version2019,
  });
}

export interface ResourceQueryParams {
  terminalPhone: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  /** Alarm filtresi (0 = tumu). */
  alarmFlag?: bigint;
  mediaType?: 0 | 1 | 2 | 3;
  streamType?: StreamType;
  storageType?: 0 | 1 | 2;
  deviceUtcOffsetMinutes?: number;
  version2019?: boolean;
}

/** 0x9205 - SD karttaki kayit listesini sorgular. */
export function buildResourceQuery(params: ResourceQueryParams): Buffer {
  const offsetMin = params.deviceUtcOffsetMinutes ?? 480;
  const body = Buffer.alloc(1 + 6 + 6 + 8 + 3);
  let offset = 0;
  body.writeUInt8(params.channel, offset);
  offset += 1;
  toBcdTime(params.startTime, offsetMin).copy(body, offset);
  offset += 6;
  toBcdTime(params.endTime, offsetMin).copy(body, offset);
  offset += 6;
  body.writeBigUInt64BE(params.alarmFlag ?? 0n, offset);
  offset += 8;
  body.writeUInt8(params.mediaType ?? 1, offset);
  offset += 1;
  body.writeUInt8(params.streamType === 'sub' ? 1 : 0, offset);
  offset += 1;
  body.writeUInt8(params.storageType ?? 0, offset);

  return buildMessage(JT_MSG.RESOURCE_QUERY, params.terminalPhone, body, {
    version2019: params.version2019,
  });
}

export interface ResourceItem {
  channel: number;
  startTime: Date;
  endTime: Date;
  alarmFlag: bigint;
  mediaType: number;
  streamType: number;
  storageType: number;
  fileSizeBytes: number;
}

/** 0x1205 - cihazdan donen SD kayit listesi. */
export function parseResourceList(body: Buffer, deviceUtcOffsetMinutes = 480): ResourceItem[] {
  if (body.length < 6) return [];
  const count = body.readUInt32BE(2);
  const items: ResourceItem[] = [];
  let offset = 6;
  for (let i = 0; i < count && offset + 28 <= body.length; i += 1) {
    items.push({
      channel: body.readUInt8(offset),
      startTime: parseBcdTime(bcdToString(body.subarray(offset + 1, offset + 7)), deviceUtcOffsetMinutes),
      endTime: parseBcdTime(bcdToString(body.subarray(offset + 7, offset + 13)), deviceUtcOffsetMinutes),
      alarmFlag: body.readBigUInt64BE(offset + 13),
      mediaType: body.readUInt8(offset + 21),
      streamType: body.readUInt8(offset + 22),
      storageType: body.readUInt8(offset + 23),
      fileSizeBytes: body.readUInt32BE(offset + 24),
    });
    offset += 28;
  }
  return items;
}

export interface FileUploadParams {
  terminalPhone: string;
  ftpHost: string;
  ftpPort: number;
  username: string;
  password: string;
  path: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  alarmFlag?: bigint;
  mediaType?: 0 | 1 | 2 | 3;
  streamType?: StreamType;
  storageType?: 0 | 1 | 2;
  /** 0: normal, 1: yalnizca sertifikali */
  condition?: number;
  deviceUtcOffsetMinutes?: number;
  version2019?: boolean;
}

/**
 * 0x9206 - SD karttaki kayit dosyasinin sunucuya (FTP) yuklenmesi.
 * Olay klipleri boylece buluta alinir ve saklama politikasina baglanir.
 */
export function buildFileUploadCommand(params: FileUploadParams): Buffer {
  const offsetMin = params.deviceUtcOffsetMinutes ?? 480;
  const host = Buffer.from(params.ftpHost, 'ascii');
  const user = Buffer.from(params.username, 'ascii');
  const pass = Buffer.from(params.password, 'ascii');
  const path = Buffer.from(params.path, 'ascii');

  const parts: Buffer[] = [
    Buffer.from([host.length]),
    host,
    u16(params.ftpPort),
    Buffer.from([user.length]),
    user,
    Buffer.from([pass.length]),
    pass,
    Buffer.from([path.length]),
    path,
    Buffer.from([params.channel]),
    toBcdTime(params.startTime, offsetMin),
    toBcdTime(params.endTime, offsetMin),
    u64(params.alarmFlag ?? 0n),
    Buffer.from([
      params.mediaType ?? 1,
      params.streamType === 'sub' ? 1 : 0,
      params.storageType ?? 0,
      params.condition ?? 0,
    ]),
  ];

  return buildMessage(JT_MSG.FILE_UPLOAD, params.terminalPhone, Buffer.concat(parts), {
    version2019: params.version2019,
  });
}

function u16(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(value, 0);
  return b;
}

function u64(value: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(value, 0);
  return b;
}

/** BCD zaman (YYMMDDhhmmss, cihaz yerel saati) -> UTC Date */
export function parseBcdTime(bcd: string, deviceUtcOffsetMinutes: number): Date {
  if (bcd.length < 12) return new Date(0);
  const yy = Number(bcd.slice(0, 2));
  const mm = Number(bcd.slice(2, 4));
  const dd = Number(bcd.slice(4, 6));
  const hh = Number(bcd.slice(6, 8));
  const mi = Number(bcd.slice(8, 10));
  const ss = Number(bcd.slice(10, 12));
  const asUtc = Date.UTC(2000 + yy, mm - 1, dd, hh, mi, ss);
  return new Date(asUtc - deviceUtcOffsetMinutes * 60_000);
}

/** UTC Date -> BCD zaman (cihaz yerel saatinde). */
export function toBcdTime(date: Date, deviceUtcOffsetMinutes: number): Buffer {
  const local = new Date(date.getTime() + deviceUtcOffsetMinutes * 60_000);
  const text =
    String(local.getUTCFullYear() % 100).padStart(2, '0') +
    String(local.getUTCMonth() + 1).padStart(2, '0') +
    String(local.getUTCDate()).padStart(2, '0') +
    String(local.getUTCHours()).padStart(2, '0') +
    String(local.getUTCMinutes()).padStart(2, '0') +
    String(local.getUTCSeconds()).padStart(2, '0');
  return stringToBcd(text, 6);
}

export const jt808 = new Jt808Decoder();
