import { describe, expect, it } from 'vitest';
import {
  activePrivacyWindow,
  evaluateAccess,
  maskPosition,
  retentionDeadline,
  DEFAULT_RETENTION_DAYS,
} from '@medentry/domain';
import type { AccessRequest } from '@medentry/domain';
import type { PrivacyWindow } from '@medentry/shared';

/** 2026-09-18 Cuma, 10:00 Turkiye saati. */
const MESAI = new Date(Date.UTC(2026, 8, 18, 7, 0, 0));
/** Ayni gun 22:00 Turkiye saati (vardiya disi). */
const GECE = new Date(Date.UTC(2026, 8, 18, 19, 0, 0));
/** Ayni gun 12:30 Turkiye saati (ogle molasi). */
const MOLA = new Date(Date.UTC(2026, 8, 18, 9, 30, 0));

const molaPenceresi: PrivacyWindow = {
  id: 'pw-mola',
  kind: 'break',
  startTime: '12:00',
  endTime: '13:00',
  weekdays: [1, 2, 3, 4, 5],
  active: true,
};

const vardiyaDisi: PrivacyWindow = {
  id: 'pw-vardiya',
  kind: 'off_shift',
  startTime: '19:00',
  endTime: '07:00',
  active: true,
};

const base: AccessRequest = {
  role: 'manager',
  purpose: 'is_guvenligi',
  dataType: 'camera_live',
  ts: MESAI,
  assetId: 'EKS-01',
  cameraPosition: 'front',
  reason: 'Santiye giris yolunda yayaya yaklasma ihbari incelenecek',
  operatorAcknowledged: true,
  privacyWindows: [molaPenceresi, vardiyaDisi],
};

describe('kamera erisim politikasi', () => {
  it('mesai icinde, gerekceli dis kamera erisimine izin verir', () => {
    const decision = evaluateAccess(base);

    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toContain('audit_log');
    expect(decision.obligations).toContain('notify_operator');
    expect(decision.obligations).toContain('no_audio');
  });

  it('gerekce yoksa reddeder', () => {
    const decision = evaluateAccess({ ...base, reason: 'kontrol' });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('REASON_REQUIRED');
  });

  it('operator aydinlatilmamissa kamerayi acmaz', () => {
    const decision = evaluateAccess({ ...base, operatorAcknowledged: false });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('NOTICE_NOT_ACKNOWLEDGED');
  });

  it('kabin kamerasinin canli izlenmesini her durumda engeller', () => {
    const decision = evaluateAccess({
      ...base,
      cameraPosition: 'cabin',
      purpose: 'kaza_inceleme',
      linkedEventId: 'evt-1',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('CABIN_LIVE_FORBIDDEN');
  });

  it('kabin goruntusunu yalnizca olaya bagli kayitta acar', () => {
    const olaysiz = evaluateAccess({
      ...base,
      dataType: 'camera_playback',
      cameraPosition: 'cabin',
      purpose: 'kaza_inceleme',
    });
    const olayli = evaluateAccess({
      ...base,
      dataType: 'camera_playback',
      cameraPosition: 'cabin',
      purpose: 'kaza_inceleme',
      linkedEventId: 'evt-2026-09-18-01',
    });

    expect(olaysiz.allowed).toBe(false);
    expect(olaysiz.code).toBe('CABIN_EVENT_REQUIRED');
    expect(olayli.allowed).toBe(true);
    expect(olayli.obligations).toContain('event_window_only');
    expect(olayli.obligations).toContain('dual_control');
  });

  it('kabin goruntusunu operasyon amaciyla actirmaz', () => {
    const decision = evaluateAccess({
      ...base,
      dataType: 'camera_playback',
      cameraPosition: 'cabin',
      purpose: 'operasyon_yonetimi',
      linkedEventId: 'evt-1',
    });

    // Amac matrisi zaten kabin verisini operasyon amacina baglamiyor.
    expect(decision.allowed).toBe(false);
    expect(['PURPOSE_MISMATCH', 'CABIN_PURPOSE_FORBIDDEN']).toContain(decision.code);
  });

  it('mola saatinde kamerayi kapatir', () => {
    const decision = evaluateAccess({ ...base, ts: MOLA });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PRIVACY_WINDOW');
    expect(decision.message).toContain('mola');
  });

  it('vardiya disinda yalnizca varlik guvenligi amaciyla dis kamerayi acar', () => {
    const hirsizlik = evaluateAccess({
      ...base,
      ts: GECE,
      purpose: 'varlik_guvenligi',
      reason: 'Gece 22:00 sonrasi makinede hareket alarmi alindi, hirsizlik suphesi',
      operatorOnShift: false,
    });
    const operasyon = evaluateAccess({ ...base, ts: GECE, purpose: 'is_guvenligi' });

    expect(hirsizlik.allowed).toBe(true);
    expect(hirsizlik.obligations).toContain('dual_control');
    expect(operasyon.allowed).toBe(false);
    expect(operasyon.code).toBe('PRIVACY_WINDOW');
  });

  it('vardiya disi istisnasi kabin kamerasina uygulanmaz', () => {
    const decision = evaluateAccess({
      ...base,
      ts: GECE,
      cameraPosition: 'cabin',
      dataType: 'camera_playback',
      purpose: 'varlik_guvenligi',
      linkedEventId: 'evt-3',
      operatorOnShift: false,
    });

    expect(decision.allowed).toBe(false);
  });

  it('operator rolu kamera goruntusu izleyemez', () => {
    const decision = evaluateAccess({ ...base, role: 'operator' });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('ROLE_FORBIDDEN');
  });

  it('amac disi veri turune erisimi reddeder', () => {
    // Hakedis amaciyla kamera goruntusu istenemez.
    const decision = evaluateAccess({ ...base, purpose: 'hakedis_faturalama' });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PURPOSE_MISMATCH');
  });
});

describe('konum erisimi', () => {
  it('konum gecmisinde mahremiyet bolgesi maskelemesi zorunlu', () => {
    const decision = evaluateAccess({
      ...base,
      dataType: 'position_history',
      purpose: 'operasyon_yonetimi',
      cameraPosition: undefined,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toContain('mask_privacy_zone');
  });

  it('ozel kullanim penceresinde yalnizca kaba konum verir', () => {
    const ozelKullanim: PrivacyWindow = {
      id: 'pw-ozel',
      kind: 'private_use',
      assetId: 'PCK-07',
      startsAt: new Date(Date.UTC(2026, 8, 18, 15, 0, 0)),
      endsAt: new Date(Date.UTC(2026, 8, 18, 20, 0, 0)),
      active: true,
    };

    const decision = evaluateAccess({
      role: 'manager',
      purpose: 'operasyon_yonetimi',
      dataType: 'position',
      assetId: 'PCK-07',
      ts: new Date(Date.UTC(2026, 8, 18, 16, 0, 0)),
      privacyWindows: [ozelKullanim],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.obligations).toContain('coarse_location_only');
  });

  it('hakedis amaciyla konum gecmisi istenemez', () => {
    const decision = evaluateAccess({
      role: 'manager',
      purpose: 'hakedis_faturalama',
      dataType: 'position_history',
      ts: MESAI,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PURPOSE_MISMATCH');
  });
});

describe('mahremiyet penceresi', () => {
  it('gun icindeki araligi bulur', () => {
    expect(activePrivacyWindow(MOLA, [molaPenceresi])?.id).toBe('pw-mola');
    expect(activePrivacyWindow(MESAI, [molaPenceresi])).toBeNull();
  });

  it('gece yarisini asan araligi dogru degerlendirir', () => {
    expect(activePrivacyWindow(GECE, [vardiyaDisi])?.id).toBe('pw-vardiya');
    // 06:00 Turkiye saati -> hala vardiya disi
    expect(activePrivacyWindow(new Date(Date.UTC(2026, 8, 18, 3, 0, 0)), [vardiyaDisi])?.id).toBe('pw-vardiya');
    expect(activePrivacyWindow(MESAI, [vardiyaDisi])).toBeNull();
  });

  it('hafta sonu tanimli olmayan pencereyi uygulamaz', () => {
    const cumartesi = new Date(Date.UTC(2026, 8, 19, 9, 30, 0));
    expect(activePrivacyWindow(cumartesi, [molaPenceresi])).toBeNull();
  });

  it('varliga ozel pencere genel pencereden onceliklidir', () => {
    const genel: PrivacyWindow = { ...molaPenceresi, id: 'genel' };
    const ozel: PrivacyWindow = { ...molaPenceresi, id: 'ozel', assetId: 'EKS-01', kind: 'private_use' };

    expect(activePrivacyWindow(MOLA, [genel, ozel], 'EKS-01')?.id).toBe('ozel');
    expect(activePrivacyWindow(MOLA, [genel, ozel], 'EKS-99')?.id).toBe('genel');
  });
});

describe('maskeleme ve saklama', () => {
  it('kaba konum ~1 km hassasiyete indirger', () => {
    const masked = maskPosition({ lat: 41.015137, lon: 28.97953 }, 'coarse');
    expect(masked).toEqual({ lat: 41.02, lon: 28.98 });
    expect(maskPosition({ lat: 41, lon: 29 }, 'hidden')).toBeNull();
  });

  it('saklama suresi veri turune gore hesaplanir', () => {
    const created = new Date(Date.UTC(2026, 0, 1));
    const deadline = retentionDeadline('camera_recording', created);
    const expected = new Date(created.getTime() + DEFAULT_RETENTION_DAYS['camera_recording']! * 86_400_000);

    expect(deadline.toISOString()).toBe(expected.toISOString());
    expect(DEFAULT_RETENTION_DAYS['camera_recording']).toBe(30);
    expect(DEFAULT_RETENTION_DAYS['billing']).toBe(3650);
  });
});
