import { describe, expect, it } from 'vitest';
import { evaluateGeofences, isInsideGeofence, privacyZonesFor, replayGeofences, timeInsideGeofence } from '@medentry/domain';
import type { Geofence } from '@medentry/shared';

const santiye: Geofence = {
  id: 'gf-santiye',
  name: 'Kartal Santiyesi',
  kind: 'circle',
  purpose: 'worksite',
  center: { lat: 40.9, lon: 29.2 },
  radiusM: 500,
  hysteresisM: 50,
  active: true,
};

const depo: Geofence = {
  id: 'gf-depo',
  name: 'Merkez Depo',
  kind: 'polygon',
  purpose: 'depot',
  polygon: [
    { lat: 41.0, lon: 29.0 },
    { lat: 41.0, lon: 29.01 },
    { lat: 41.01, lon: 29.01 },
    { lat: 41.01, lon: 29.0 },
  ],
  active: true,
};

describe('geofence icinde mi', () => {
  it('daire citini degerlendirir', () => {
    expect(isInsideGeofence({ lat: 40.9, lon: 29.2 }, santiye)).toBe(true);
    expect(isInsideGeofence({ lat: 40.95, lon: 29.2 }, santiye)).toBe(false);
  });

  it('poligon citini degerlendirir', () => {
    expect(isInsideGeofence({ lat: 41.005, lon: 29.005 }, depo)).toBe(true);
    expect(isInsideGeofence({ lat: 41.02, lon: 29.005 }, depo)).toBe(false);
  });

  it('tampon ile poligon sinirini genisletir', () => {
    const disarida = { lat: 41.0105, lon: 29.005 }; // ~55 m disarida
    expect(isInsideGeofence(disarida, depo)).toBe(false);
    expect(isInsideGeofence(disarida, depo, 100)).toBe(true);
  });
});

describe('giris/cikis olaylari', () => {
  it('ilk giriste enter olayi uretir', () => {
    const result = evaluateGeofences({ lat: 40.9, lon: 29.2 }, new Date(), [santiye]);

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]?.kind).toBe('enter');
    expect(result.state.has('gf-santiye')).toBe(true);
  });

  it('icerideyken tekrar enter uretmez', () => {
    const first = evaluateGeofences({ lat: 40.9, lon: 29.2 }, new Date(), [santiye]);
    const second = evaluateGeofences({ lat: 40.9001, lon: 29.2 }, new Date(), [santiye], first.state);

    expect(second.transitions).toHaveLength(0);
  });

  it('histerezis sinir titremesini engeller', () => {
    const inside = evaluateGeofences({ lat: 40.9, lon: 29.2 }, new Date(), [santiye]);
    // Sinirin 20 m disinda: histerezis (50 m) nedeniyle hala iceride sayilir.
    const near = evaluateGeofences({ lat: 40.90467, lon: 29.2 }, new Date(), [santiye], inside.state);

    expect(near.transitions).toHaveLength(0);
    expect(near.state.has('gf-santiye')).toBe(true);

    // 200 m disari: artik cikis olayi uretilir.
    const out = evaluateGeofences({ lat: 40.9063, lon: 29.2 }, new Date(), [santiye], near.state);
    expect(out.transitions[0]?.kind).toBe('exit');
  });

  it('pasif citleri degerlendirmez', () => {
    const result = evaluateGeofences({ lat: 40.9, lon: 29.2 }, new Date(), [{ ...santiye, active: false }]);
    expect(result.transitions).toHaveLength(0);
  });
});

describe('santiyede gecen sure', () => {
  it('giris-cikis ciftlerinden sureyi toplar', () => {
    const t = (min: number): Date => new Date(Date.UTC(2026, 8, 18, 4, 0, 0) + min * 60_000);
    const points = [
      { ts: t(0), lat: 41.5, lon: 29.5 }, // disarida
      { ts: t(30), lat: 40.9, lon: 29.2 }, // girdi
      { ts: t(300), lat: 40.9, lon: 29.2 }, // hala iceride
      { ts: t(330), lat: 41.5, lon: 29.5 }, // cikti
    ];

    const { transitions } = replayGeofences(points, [santiye]);
    const seconds = timeInsideGeofence(transitions, 'gf-santiye', t(0), t(600));

    expect(transitions.map((x) => x.kind)).toEqual(['enter', 'exit']);
    expect(seconds).toBe(300 * 60);
  });

  it('gun sonunda hala icerideyse pencere sonuna kadar sayar', () => {
    const t = (min: number): Date => new Date(Date.UTC(2026, 8, 18, 4, 0, 0) + min * 60_000);
    const { transitions } = replayGeofences(
      [
        { ts: t(0), lat: 41.5, lon: 29.5 },
        { ts: t(60), lat: 40.9, lon: 29.2 },
      ],
      [santiye],
    );

    expect(timeInsideGeofence(transitions, 'gf-santiye', t(0), t(120))).toBe(60 * 60);
  });
});

describe('mahremiyet bolgesi', () => {
  it('konumun dustugu mahremiyet bolgelerini dondurur', () => {
    const evAdresi: Geofence = {
      id: 'gf-mahrem',
      name: 'Operator ikametgahi',
      kind: 'circle',
      purpose: 'privacy_zone',
      center: { lat: 41.1, lon: 29.1 },
      radiusM: 300,
      active: true,
    };

    expect(privacyZonesFor({ lat: 41.1, lon: 29.1 }, [santiye, evAdresi])).toHaveLength(1);
    expect(privacyZonesFor({ lat: 40.9, lon: 29.2 }, [santiye, evAdresi])).toHaveLength(0);
  });
});
