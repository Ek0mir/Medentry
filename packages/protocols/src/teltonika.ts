/**
 * Teltonika Codec8 / Codec8 Extended (FMB/FMC serisi).
 *
 * Is makineleri icin tercih edilen cihaz ailesidir: CAN adaptoru (LV-CAN200 /
 * ALL-CAN300) ile motor devri, motor calisma saati ve yakit seviyesi dogrudan
 * makineden okunabilir. Kontak (IO 239) ve hareket (IO 240) bilgisi standarttir.
 *
 * TCP akisi:
 *   1) Ilk paket: uzunluk(2) + IMEI (ASCII). Sunucu 0x01 ile kabul eder.
 *   2) Veri paketi: 0x00000000 | veri uzunlugu(4) | codec(1) | kayit sayisi(1)
 *      | kayitlar | kayit sayisi(1) | CRC16-ARC(4)
 *   3) Sunucu, alinan kayit sayisini 4 bayt olarak geri gonderir.
 *
 * NOT: CAN uzerinden gelen IO numaralari cihaz firmware'ine ve arac/makine
 * profiline gore degisebilir. Asagidaki eslesme FMB + LV-CAN200 varsayilanidir
 * ve devreye alma sirasinda cihazin AVL ID dokumaniyla DOGRULANMALIDIR.
 * `createTeltonikaDecoder({ ioMap })` ile proje bazinda ezilebilir.
 */

import type { AlarmCode, NormalizedRecord } from '@medentry/shared';
import { crc16Arc } from './checksum.js';
import type { DecodedMessage, DecodeResult, DecoderSession, ProtocolDecoder } from './types.js';

/** Platformun anladigi olculer. */
export type TelemetryField =
  | 'ignition'
  | 'movement'
  | 'gsmSignal'
  | 'externalV'
  | 'batteryV'
  | 'odometerM'
  | 'engineRpm'
  | 'engineHoursSec'
  | 'fuelLevelPct'
  | 'fuelLevelLiters'
  | 'fuelUsedLiters'
  | 'coolantTempC'
  | 'hdop';

export interface IoDefinition {
  field: TelemetryField;
  /** Ham degeri hedef birime ceviren carpan. */
  scale?: number;
  /** Bool alanlar icin. */
  boolean?: boolean;
}

/** Varsayilan AVL IO eslesmesi (FMB + LV-CAN200). */
export const DEFAULT_IO_MAP: Readonly<Record<number, IoDefinition>> = {
  21: { field: 'gsmSignal' },
  66: { field: 'externalV', scale: 0.001 }, // mV -> V
  67: { field: 'batteryV', scale: 0.001 },
  16: { field: 'odometerM' },
  182: { field: 'hdop', scale: 0.1 },
  239: { field: 'ignition', boolean: true },
  240: { field: 'movement', boolean: true },
  // --- CAN adaptoru ---
  83: { field: 'fuelUsedLiters', scale: 0.1 },
  84: { field: 'fuelLevelLiters', scale: 0.1 },
  85: { field: 'engineRpm' },
  89: { field: 'fuelLevelPct' },
  102: { field: 'engineHoursSec', scale: 60 }, // dakika -> saniye
  115: { field: 'coolantTempC' },
};

/** Olay IO numarasindan alarm kodu uretimi. */
const EVENT_ALARMS: Record<number, AlarmCode> = {
  247: 'crash',
  249: 'jamming',
  252: 'power_cut',
  253: 'harsh_acceleration',
  255: 'overspeed',
  246: 'tow',
  236: 'sos',
};

export interface TeltonikaOptions {
  ioMap?: Record<number, IoDefinition>;
}

export class TeltonikaDecoder implements ProtocolDecoder {
  readonly name = 'teltonika' as const;
  readonly defaultPort = 5027;
  private readonly ioMap: Record<number, IoDefinition>;

  constructor(options: TeltonikaOptions = {}) {
    this.ioMap = { ...DEFAULT_IO_MAP, ...(options.ioMap ?? {}) };
  }

  decode(buffer: Buffer, session: DecoderSession): DecodeResult {
    const messages: DecodedMessage[] = [];
    let rest = buffer;

    while (rest.length > 0) {
      // Kimlik dogrulanmadan once gelen paket IMEI'dir.
      if (!session.deviceIdent) {
        if (rest.length < 2) break;
        const imeiLength = rest.readUInt16BE(0);
        if (imeiLength === 0 || imeiLength > 20) {
          // Gecersiz: akis bozuk, baglanti reddedilmeli.
          messages.push({ kind: 'unknown', ack: Buffer.from([0x00]), meta: { error: 'bad_imei_length' } });
          return { messages, rest: Buffer.alloc(0) };
        }
        if (rest.length < 2 + imeiLength) break;
        const imei = rest.subarray(2, 2 + imeiLength).toString('ascii');
        session.deviceIdent = imei;
        messages.push({ kind: 'login', deviceIdent: imei, ack: Buffer.from([0x01]) });
        rest = rest.subarray(2 + imeiLength);
        continue;
      }

      if (rest.length < 12) break;
      if (rest.readUInt32BE(0) !== 0) {
        // Senkron kaybi: bir bayt kaydirip yeniden dene.
        rest = rest.subarray(1);
        continue;
      }
      const dataLength = rest.readUInt32BE(4);
      const total = 8 + dataLength + 4;
      if (rest.length < total) break;

      const dataField = rest.subarray(8, 8 + dataLength);
      const crcExpected = rest.readUInt32BE(8 + dataLength) & 0xffff;
      const crcActual = crc16Arc(dataField);
      rest = rest.subarray(total);

      if (crcExpected !== crcActual) {
        messages.push({
          kind: 'unknown',
          ack: Buffer.from([0x00, 0x00, 0x00, 0x00]),
          meta: { error: 'crc_mismatch', crcExpected, crcActual },
        });
        continue;
      }

      const parsed = this.parseDataField(dataField, session.deviceIdent as string);
      for (const record of parsed.records) {
        messages.push({ kind: 'position', deviceIdent: session.deviceIdent as string, record });
      }
      const ack = Buffer.alloc(4);
      ack.writeUInt32BE(parsed.records.length, 0);
      messages.push({ kind: 'response', deviceIdent: session.deviceIdent as string, ack });
    }

    return { messages, rest };
  }

  private parseDataField(data: Buffer, imei: string): { records: NormalizedRecord[] } {
    const codecId = data.readUInt8(0);
    const extended = codecId === 0x8e;
    const count = data.readUInt8(1);
    const records: NormalizedRecord[] = [];
    let offset = 2;

    for (let i = 0; i < count && offset < data.length; i += 1) {
      const result = this.parseRecord(data, offset, extended, imei);
      if (!result) break;
      records.push(result.record);
      offset = result.offset;
    }
    return { records };
  }

  private parseRecord(
    data: Buffer,
    start: number,
    extended: boolean,
    imei: string,
  ): { record: NormalizedRecord; offset: number } | null {
    let offset = start;
    if (offset + 24 > data.length) return null;

    const timestampMs = Number(data.readBigUInt64BE(offset));
    offset += 8;
    const priority = data.readUInt8(offset);
    offset += 1;

    const lon = data.readInt32BE(offset) / 1e7;
    offset += 4;
    const lat = data.readInt32BE(offset) / 1e7;
    offset += 4;
    const altitude = data.readInt16BE(offset);
    offset += 2;
    const angle = data.readUInt16BE(offset);
    offset += 2;
    const satellites = data.readUInt8(offset);
    offset += 1;
    const speed = data.readUInt16BE(offset);
    offset += 2;

    const record: NormalizedRecord = {
      deviceIdent: imei,
      protocol: 'teltonika',
      timestamp: new Date(timestampMs),
      position: { lat, lon },
      gpsValid: satellites > 0 && !(lat === 0 && lon === 0),
      speedKph: speed,
      headingDeg: angle,
      altitudeM: altitude,
      satellites,
      raw: { priority, codec: extended ? '8E' : '8' },
    };

    // --- IO elemanlari ---
    const readId = (): number => {
      const v = extended ? data.readUInt16BE(offset) : data.readUInt8(offset);
      offset += extended ? 2 : 1;
      return v;
    };
    const readCount = (): number => {
      const v = extended ? data.readUInt16BE(offset) : data.readUInt8(offset);
      offset += extended ? 2 : 1;
      return v;
    };

    const eventIoId = readId();
    readCount(); // toplam IO sayisi - dogrulama disinda kullanilmiyor

    const io: Record<number, number> = {};
    for (const size of [1, 2, 4, 8] as const) {
      const n = readCount();
      for (let i = 0; i < n; i += 1) {
        if (offset + (extended ? 2 : 1) + size > data.length) return null;
        const id = readId();
        let value: number;
        switch (size) {
          case 1:
            value = data.readUInt8(offset);
            break;
          case 2:
            value = data.readUInt16BE(offset);
            break;
          case 4:
            value = data.readUInt32BE(offset);
            break;
          default:
            value = Number(data.readBigUInt64BE(offset));
            break;
        }
        offset += size;
        io[id] = value;
      }
    }

    if (extended) {
      // Degisken uzunluklu elemanlar (NX) - su an ham olarak atlanir.
      if (offset + 2 > data.length) return null;
      const nx = data.readUInt16BE(offset);
      offset += 2;
      for (let i = 0; i < nx; i += 1) {
        if (offset + 4 > data.length) return null;
        offset += 2; // id
        const len = data.readUInt16BE(offset);
        offset += 2 + len;
      }
    }

    this.applyIo(record, io);
    if (eventIoId !== 0) {
      const alarm = EVENT_ALARMS[eventIoId];
      record.alarms = alarm ? [alarm] : [];
      (record.raw as Record<string, unknown>)['eventIoId'] = eventIoId;
    }
    (record.raw as Record<string, unknown>)['io'] = io;

    return { record, offset };
  }

  private applyIo(record: NormalizedRecord, io: Record<number, number>): void {
    for (const [idText, rawValue] of Object.entries(io)) {
      const def = this.ioMap[Number(idText)];
      if (!def) continue;
      if (def.boolean) {
        (record as Record<string, unknown>)[def.field] = rawValue !== 0;
        continue;
      }
      const value = def.scale ? Math.round(rawValue * def.scale * 1000) / 1000 : rawValue;
      (record as Record<string, unknown>)[def.field] = value;
    }
  }
}

export function createTeltonikaDecoder(options: TeltonikaOptions = {}): TeltonikaDecoder {
  return new TeltonikaDecoder(options);
}

export const teltonika = new TeltonikaDecoder();
