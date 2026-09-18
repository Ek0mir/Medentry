import { describe, expect, it } from 'vitest';
import {
  JT_MSG,
  Jt808Decoder,
  buildFileUploadCommand,
  buildLiveRequest,
  buildMessage,
  buildPlaybackRequest,
  buildResourceQuery,
  escapeFrame,
  parseBcdTime,
  parseHeader,
  toBcdTime,
  unescapeFrame,
} from '@medentry/protocols';
import { stringToBcd, xorChecksum } from '@medentry/protocols';
import type { DecoderSession } from '@medentry/protocols';

const TERMINAL = '013800138000';

/** Test icin cihaz tarafi 0x0200 konum paketi uretir. */
function buildLocationPacket(options: {
  lat: number;
  lon: number;
  speedKph: number;
  ignition: boolean;
  timestamp: Date;
  offsetMinutes?: number;
  fuelLiters?: number;
}): Buffer {
  const body = Buffer.alloc(28);
  body.writeUInt32BE(0, 0); // alarm
  let status = options.ignition ? 0x01 : 0x00;
  status |= 0x02; // konum gecerli
  if (options.lat < 0) status |= 0x04;
  if (options.lon < 0) status |= 0x08;
  body.writeUInt32BE(status, 4);
  body.writeUInt32BE(Math.round(Math.abs(options.lat) * 1e6), 8);
  body.writeUInt32BE(Math.round(Math.abs(options.lon) * 1e6), 12);
  body.writeUInt16BE(100, 16);
  body.writeUInt16BE(Math.round(options.speedKph * 10), 18);
  body.writeUInt16BE(45, 20);
  toBcdTime(options.timestamp, options.offsetMinutes ?? 480).copy(body, 22);

  const extras: Buffer[] = [];
  if (options.fuelLiters !== undefined) {
    const tlv = Buffer.alloc(4);
    tlv.writeUInt8(0x02, 0);
    tlv.writeUInt8(2, 1);
    tlv.writeUInt16BE(Math.round(options.fuelLiters * 10), 2);
    extras.push(tlv);
  }

  return buildMessage(JT_MSG.LOCATION, TERMINAL, Buffer.concat([body, ...extras]));
}

describe('JT/T 808 protokolu', () => {
  it('kacis (escape) donusumu tersine cevrilebilir', () => {
    const raw = Buffer.from([0x01, 0x7e, 0x7d, 0x02, 0x7e]);
    const escaped = escapeFrame(raw);

    expect(escaped).not.toEqual(raw);
    expect(unescapeFrame(escaped)).toEqual(raw);
  });

  it('konum paketini cozer, kontak ve yakit okur', () => {
    const decoder = new Jt808Decoder({ deviceUtcOffsetMinutes: 480 });
    const session: DecoderSession = {};
    const ts = new Date(Date.UTC(2026, 8, 18, 7, 15, 0));

    const packet = buildLocationPacket({
      lat: 41.0082,
      lon: 28.9784,
      speedKph: 36.5,
      ignition: true,
      timestamp: ts,
      fuelLiters: 145.5,
    });
    const { messages } = decoder.decode(packet, session);
    const record = messages[0]?.record;

    expect(messages[0]?.kind).toBe('position');
    expect(record?.position?.lat).toBeCloseTo(41.0082, 4);
    expect(record?.position?.lon).toBeCloseTo(28.9784, 4);
    expect(record?.speedKph).toBeCloseTo(36.5, 1);
    expect(record?.ignition).toBe(true);
    expect(record?.gpsValid).toBe(true);
    expect(record?.fuelLevelLiters).toBeCloseTo(145.5, 1);
    // Cihaz yerel saatiyle (UTC+8) gonderdi, platform UTC'ye cevirmeli.
    expect(record?.timestamp.toISOString()).toBe(ts.toISOString());
    expect(messages[0]?.ack).toBeDefined();
  });

  it('kontak kapali durumu dogru okunur', () => {
    const decoder = new Jt808Decoder();
    const session: DecoderSession = {};
    const packet = buildLocationPacket({
      lat: 41.0,
      lon: 29.0,
      speedKph: 0,
      ignition: false,
      timestamp: new Date(),
    });

    const record = decoder.decode(packet, session).messages[0]?.record;
    expect(record?.ignition).toBe(false);
  });

  it('bozuk saglama baytini reddeder', () => {
    const decoder = new Jt808Decoder();
    const session: DecoderSession = {};
    const packet = Buffer.from(
      buildLocationPacket({ lat: 41, lon: 29, speedKph: 0, ignition: true, timestamp: new Date() }),
    );
    // Son 7E'den onceki bayt saglamadir.
    packet[packet.length - 2] = (packet[packet.length - 2]! ^ 0x5a) & 0xff;

    const { messages } = decoder.decode(packet, session);
    expect(messages[0]?.kind).toBe('unknown');
    expect(messages[0]?.meta?.['error']).toBe('checksum_mismatch');
  });

  it('BCD zaman donusumu cift yonlu calisir', () => {
    const ts = new Date(Date.UTC(2026, 11, 31, 21, 30, 15));
    const bcd = toBcdTime(ts, 180); // UTC+3 ayarli cihaz
    const hex = bcd.toString('hex');

    expect(hex).toBe('270101003015'); // 2027-01-01 00:30:15 yerel
    expect(parseBcdTime(hex, 180).toISOString()).toBe(ts.toISOString());
  });
});

describe('JT/T 1078 video komutlari', () => {
  it('0x9101 canli yayin komutu dogru govdeyi tasir', () => {
    const frame = buildLiveRequest({
      terminalPhone: TERMINAL,
      serverIp: '10.0.0.5',
      tcpPort: 7618,
      channel: 2,
      dataType: 'video',
      streamType: 'sub',
    });

    const payload = unescapeFrame(frame.subarray(1, frame.length - 1));
    const header = parseHeader(payload);
    const body = payload.subarray(header.headerLength, header.headerLength + header.bodyLength);

    expect(header.msgId).toBe(JT_MSG.LIVE_REQUEST);
    expect(header.terminalPhone).toBe(TERMINAL.replace(/^0+/, ''));
    const ipLen = body.readUInt8(0);
    expect(body.subarray(1, 1 + ipLen).toString('ascii')).toBe('10.0.0.5');
    expect(body.readUInt16BE(1 + ipLen)).toBe(7618);
    expect(body.readUInt8(1 + ipLen + 4)).toBe(2); // kanal
    expect(body.readUInt8(1 + ipLen + 5)).toBe(1); // yalnizca video (sessiz)
    expect(body.readUInt8(1 + ipLen + 6)).toBe(1); // alt akis
  });

  it('0x9201 SD geri oynatma komutu zaman araligini tasir', () => {
    const start = new Date(Date.UTC(2026, 8, 18, 6, 0, 0));
    const end = new Date(Date.UTC(2026, 8, 18, 6, 5, 0));
    const frame = buildPlaybackRequest({
      terminalPhone: TERMINAL,
      serverIp: '10.0.0.5',
      tcpPort: 7618,
      channel: 1,
      startTime: start,
      endTime: end,
      deviceUtcOffsetMinutes: 180,
    });

    const payload = unescapeFrame(frame.subarray(1, frame.length - 1));
    const header = parseHeader(payload);
    const body = payload.subarray(header.headerLength, header.headerLength + header.bodyLength);
    const ipLen = body.readUInt8(0);
    const timeOffset = 1 + ipLen + 2 + 2 + 6;

    expect(header.msgId).toBe(JT_MSG.PLAYBACK_REQUEST);
    expect(parseBcdTime(body.subarray(timeOffset, timeOffset + 6).toString('hex'), 180).toISOString()).toBe(
      start.toISOString(),
    );
    expect(
      parseBcdTime(body.subarray(timeOffset + 6, timeOffset + 12).toString('hex'), 180).toISOString(),
    ).toBe(end.toISOString());
  });

  it('0x9205 kayit listesi sorgusu ve 0x1205 yaniti eslesir', () => {
    const start = new Date(Date.UTC(2026, 8, 18, 0, 0, 0));
    const end = new Date(Date.UTC(2026, 8, 18, 23, 59, 0));
    const query = buildResourceQuery({
      terminalPhone: TERMINAL,
      channel: 1,
      startTime: start,
      endTime: end,
      deviceUtcOffsetMinutes: 180,
    });
    expect(parseHeader(unescapeFrame(query.subarray(1, query.length - 1))).msgId).toBe(
      JT_MSG.RESOURCE_QUERY,
    );

    // Cihaz yaniti: seri(2) + adet(4) + oge(28)
    const item = Buffer.alloc(28);
    item.writeUInt8(1, 0);
    toBcdTime(start, 180).copy(item, 1);
    toBcdTime(end, 180).copy(item, 7);
    item.writeBigUInt64BE(0n, 13);
    item.writeUInt8(1, 21);
    item.writeUInt8(0, 22);
    item.writeUInt8(1, 23);
    item.writeUInt32BE(48_000_000, 24);
    const body = Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x01]), item]);
    const response = buildMessage(JT_MSG.RESOURCE_LIST, TERMINAL, body);

    const decoder = new Jt808Decoder({ deviceUtcOffsetMinutes: 180 });
    const { messages } = decoder.decode(response, {});
    const resources = messages[0]?.meta?.['resources'] as Array<Record<string, unknown>>;

    expect(messages[0]?.kind).toBe('media');
    expect(resources).toHaveLength(1);
    expect(resources[0]?.['channel']).toBe(1);
    expect(resources[0]?.['fileSizeBytes']).toBe(48_000_000);
    expect((resources[0]?.['startTime'] as Date).toISOString()).toBe(start.toISOString());
  });

  it('0x9206 dosya yukleme komutu FTP bilgilerini tasir', () => {
    const frame = buildFileUploadCommand({
      terminalPhone: TERMINAL,
      ftpHost: 'media.ornek.com',
      ftpPort: 21,
      username: 'mdvr',
      password: 'gizli',
      path: '/olay/2026-09-18',
      channel: 1,
      startTime: new Date(Date.UTC(2026, 8, 18, 6, 0, 0)),
      endTime: new Date(Date.UTC(2026, 8, 18, 6, 1, 0)),
    });

    const payload = unescapeFrame(frame.subarray(1, frame.length - 1));
    const header = parseHeader(payload);
    const body = payload.subarray(header.headerLength, header.headerLength + header.bodyLength);

    expect(header.msgId).toBe(JT_MSG.FILE_UPLOAD);
    const hostLen = body.readUInt8(0);
    expect(body.subarray(1, 1 + hostLen).toString('ascii')).toBe('media.ornek.com');
  });

  it('cerceve saglama baytı XOR ile dogrulanabilir', () => {
    const frame = buildMessage(JT_MSG.PLATFORM_GENERAL_RESPONSE, TERMINAL, Buffer.alloc(5));
    const payload = unescapeFrame(frame.subarray(1, frame.length - 1));

    expect(xorChecksum(payload.subarray(0, payload.length - 1))).toBe(payload[payload.length - 1]);
    expect(stringToBcd(TERMINAL, 6).length).toBe(6);
  });
});
