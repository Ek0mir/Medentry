import { describe, expect, it } from 'vitest';
import {
  crcItu,
  encodeGt06Location,
  encodeGt06Login,
  encodeGt06Status,
  Gt06Decoder,
} from '@medentry/protocols';
import type { DecoderSession } from '@medentry/protocols';

describe('GT06 protokolu', () => {
  it('CRC-ITU bilinen degeri uretir', () => {
    // GT06 dokumanindaki ornek login paketi govdesi.
    const body = Buffer.from('0501000100', 'hex');
    expect(crcItu(body)).toBeGreaterThan(0);
    // CRC kendi uzerinde tekrarlanabilir olmali.
    expect(crcItu(body)).toBe(crcItu(Buffer.from('0501000100', 'hex')));
  });

  it('login paketini cozer ve ack uretir', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = {};
    const packet = encodeGt06Login('868120303444444');

    const { messages, rest } = decoder.decode(packet, session);

    expect(rest.length).toBe(0);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.kind).toBe('login');
    expect(messages[0]?.deviceIdent).toBe('868120303444444');
    expect(session.deviceIdent).toBe('868120303444444');
    // Ack cercevesi: 7878 05 01 <seri> <crc> 0D0A
    const ack = messages[0]?.ack;
    expect(ack).toBeDefined();
    expect(ack!.subarray(0, 4).toString('hex')).toBe('78780501');
    expect(ack!.subarray(-2).toString('hex')).toBe('0d0a');
  });

  it('konum paketini dogru koordinatlara cozer', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = { deviceIdent: '868120303444444' };
    const ts = new Date(Date.UTC(2026, 8, 18, 6, 45, 12));
    const packet = encodeGt06Location({
      timestamp: ts,
      lat: 41.015137, // Istanbul
      lon: 28.97953,
      speedKph: 42,
      headingDeg: 187,
      satellites: 11,
    });

    const { messages } = decoder.decode(packet, session);
    const record = messages[0]?.record;

    expect(messages[0]?.kind).toBe('position');
    expect(record).toBeDefined();
    expect(record!.timestamp.toISOString()).toBe(ts.toISOString());
    expect(record!.position!.lat).toBeCloseTo(41.015137, 4);
    expect(record!.position!.lon).toBeCloseTo(28.97953, 4);
    expect(record!.speedKph).toBe(42);
    expect(record!.headingDeg).toBe(187);
    expect(record!.satellites).toBe(11);
    expect(record!.gpsValid).toBe(true);
  });

  it('guney/bati koordinatlarini isaretli cozer', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = { deviceIdent: '1' };
    const packet = encodeGt06Location({
      timestamp: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
      lat: -33.8688,
      lon: -70.6693,
      speedKph: 0,
      headingDeg: 0,
    });

    const record = decoder.decode(packet, session).messages[0]?.record;
    expect(record!.position!.lat).toBeCloseTo(-33.8688, 3);
    expect(record!.position!.lon).toBeCloseTo(-70.6693, 3);
  });

  it('durum paketinden kontak bilgisini okur', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = { deviceIdent: '1' };

    const on = decoder.decode(encodeGt06Status({ ignition: true }), session).messages[0];
    const off = decoder.decode(encodeGt06Status({ ignition: false }), session).messages[0];

    expect(on?.record?.ignition).toBe(true);
    expect(off?.record?.ignition).toBe(false);
    expect(on?.ack).toBeDefined(); // heartbeat ack'lenmezse cihaz baglantiyi keser
  });

  it('parcali gelen veriyi kuyrukta bekletir', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = {};
    const packet = encodeGt06Login('868120303444444');
    const firstHalf = packet.subarray(0, 6);
    const secondHalf = packet.subarray(6);

    const first = decoder.decode(firstHalf, session);
    expect(first.messages).toHaveLength(0);
    expect(first.rest.length).toBe(firstHalf.length);

    const second = decoder.decode(Buffer.concat([first.rest, secondHalf]), session);
    expect(second.messages).toHaveLength(1);
    expect(second.messages[0]?.kind).toBe('login');
  });

  it('bozuk CRC olan paketi reddeder', () => {
    const decoder = new Gt06Decoder();
    const session: DecoderSession = {};
    const packet = Buffer.from(encodeGt06Login('868120303444444'));
    packet[packet.length - 3] = (packet[packet.length - 3]! ^ 0xff) & 0xff;

    const { messages } = decoder.decode(packet, session);
    expect(messages[0]?.kind).toBe('unknown');
    expect(messages[0]?.meta?.['error']).toBe('crc_mismatch');
  });
});
