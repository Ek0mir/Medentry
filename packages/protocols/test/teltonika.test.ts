import { describe, expect, it } from 'vitest';
import {
  TeltonikaDecoder,
  encodeTeltonikaData,
  encodeTeltonikaImei,
  createTeltonikaDecoder,
} from '@medentry/protocols';
import type { DecoderSession } from '@medentry/protocols';

const IMEI = '356307042441013';

describe('Teltonika Codec8', () => {
  it('IMEI el sikismasini kabul eder', () => {
    const decoder = new TeltonikaDecoder();
    const session: DecoderSession = {};

    const { messages } = decoder.decode(encodeTeltonikaImei(IMEI), session);

    expect(messages[0]?.kind).toBe('login');
    expect(messages[0]?.deviceIdent).toBe(IMEI);
    expect(messages[0]?.ack).toEqual(Buffer.from([0x01]));
  });

  it('AVL kaydini konum + IO alanlariyla cozer', () => {
    const decoder = new TeltonikaDecoder();
    const session: DecoderSession = {};
    decoder.decode(encodeTeltonikaImei(IMEI), session);

    const ts = new Date(Date.UTC(2026, 8, 18, 5, 30, 0));
    const packet = encodeTeltonikaData([
      {
        timestamp: ts,
        lat: 39.925533,
        lon: 32.866287, // Ankara
        speedKph: 0,
        headingDeg: 90,
        satellites: 12,
        altitudeM: 850,
        io1: { 239: 1, 240: 0, 21: 4 }, // kontak acik, hareket yok
        io2: { 66: 27_800, 85: 1450, 89: 62 }, // 27.8V, 1450 rpm, %62 yakit
        io4: { 16: 125_000, 102: 5400 }, // 125 km, 5400 dakika motor saati
      },
    ]);

    const { messages } = decoder.decode(packet, session);
    const position = messages.find((m) => m.kind === 'position');
    const ack = messages.find((m) => m.kind === 'response')?.ack;

    expect(position?.record?.timestamp.toISOString()).toBe(ts.toISOString());
    expect(position?.record?.position?.lat).toBeCloseTo(39.925533, 5);
    expect(position?.record?.position?.lon).toBeCloseTo(32.866287, 5);
    expect(position?.record?.ignition).toBe(true);
    expect(position?.record?.movement).toBe(false);
    expect(position?.record?.externalV).toBeCloseTo(27.8, 2);
    expect(position?.record?.engineRpm).toBe(1450);
    expect(position?.record?.fuelLevelPct).toBe(62);
    expect(position?.record?.odometerM).toBe(125_000);
    // 5400 dakika = 324000 saniye = 90 saat
    expect(position?.record?.engineHoursSec).toBe(324_000);
    // Cihaz, alinan kayit sayisini 4 bayt olarak bekler.
    expect(ack).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x01]));
  });

  it('tek pakette birden fazla kaydi cozer', () => {
    const decoder = new TeltonikaDecoder();
    const session: DecoderSession = {};
    decoder.decode(encodeTeltonikaImei(IMEI), session);

    const base = Date.UTC(2026, 8, 18, 5, 0, 0);
    const packet = encodeTeltonikaData([
      { timestamp: new Date(base), lat: 39.9, lon: 32.8, io1: { 239: 1 } },
      { timestamp: new Date(base + 60_000), lat: 39.91, lon: 32.81, io1: { 239: 1 } },
      { timestamp: new Date(base + 120_000), lat: 39.92, lon: 32.82, io1: { 239: 0 } },
    ]);

    const { messages } = decoder.decode(packet, session);
    const positions = messages.filter((m) => m.kind === 'position');

    expect(positions).toHaveLength(3);
    expect(positions[2]?.record?.ignition).toBe(false);
    expect(messages.find((m) => m.kind === 'response')?.ack?.readUInt32BE(0)).toBe(3);
  });

  it('IO eslesmesi proje bazinda ezilebilir', () => {
    // Bazi CAN profillerinde yakit yuzdesi farkli IO numarasindan gelir.
    const decoder = createTeltonikaDecoder({ ioMap: { 48: { field: 'fuelLevelPct' } } });
    const session: DecoderSession = {};
    decoder.decode(encodeTeltonikaImei(IMEI), session);

    const packet = encodeTeltonikaData([
      { timestamp: new Date(), lat: 39.9, lon: 32.8, io1: { 48: 77 } },
    ]);
    const record = decoder.decode(packet, session).messages[0]?.record;

    expect(record?.fuelLevelPct).toBe(77);
  });

  it('CRC hatasinda kaydi kabul etmez', () => {
    const decoder = new TeltonikaDecoder();
    const session: DecoderSession = {};
    decoder.decode(encodeTeltonikaImei(IMEI), session);

    const packet = Buffer.from(
      encodeTeltonikaData([{ timestamp: new Date(), lat: 39.9, lon: 32.8 }]),
    );
    packet[packet.length - 1] = (packet[packet.length - 1]! ^ 0xff) & 0xff;

    const { messages } = decoder.decode(packet, session);
    expect(messages[0]?.kind).toBe('unknown');
    expect(messages[0]?.meta?.['error']).toBe('crc_mismatch');
  });

  it('yarim gelen paketi bekletir', () => {
    const decoder = new TeltonikaDecoder();
    const session: DecoderSession = {};
    decoder.decode(encodeTeltonikaImei(IMEI), session);

    const packet = encodeTeltonikaData([{ timestamp: new Date(), lat: 39.9, lon: 32.8 }]);
    const first = decoder.decode(packet.subarray(0, 15), session);
    expect(first.messages).toHaveLength(0);

    const second = decoder.decode(Buffer.concat([first.rest, packet.subarray(15)]), session);
    expect(second.messages.filter((m) => m.kind === 'position')).toHaveLength(1);
  });
});
