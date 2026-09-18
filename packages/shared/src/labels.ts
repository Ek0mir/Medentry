/** Kullaniciya gosterilen Turkce etiketler (API ve arayuz ortak kullanir). */

import type { AssetType, CameraPosition, ProcessingPurpose, UserRole } from './types.js';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  excavator: 'Ekskavator',
  loader: 'Yukleyici',
  backhoe: 'Beko Loder',
  dozer: 'Dozer',
  grader: 'Greyder',
  roller: 'Silindir',
  crane: 'Vinc',
  forklift: 'Forklift',
  truck: 'Kamyon',
  pickup: 'Pickup',
  van: 'Panelvan',
  car: 'Binek Arac',
  other: 'Diger',
};

export const CAMERA_POSITION_LABELS: Record<CameraPosition, string> = {
  cabin: 'Kabin Ici',
  front: 'On',
  rear: 'Arka',
  left: 'Sol',
  right: 'Sag',
  boom: 'Bom / Calisma Alani',
  vehicle_front: 'Arac On Kamerasi',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Firma Sahibi',
  manager: 'Yonetici',
  site_chief: 'Santiye Sefi',
  operator: 'Operator',
  viewer: 'Izleyici',
  dpo: 'KVKK Irtibat Kisisi',
};

/**
 * Isleme amaclari ve KVKK m.5 hukuki sebepleri.
 * Aydinlatma metni ve VERBIS envanteri bu tablodan uretilir.
 */
export const PURPOSE_CATALOG: Record<
  ProcessingPurpose,
  { label: string; legalBasis: string; description: string }
> = {
  is_guvenligi: {
    label: 'Is Sagligi ve Guvenligi',
    legalBasis: 'KVKK m.5/2-c ve m.5/2-f; 6331 sayili Kanun m.4',
    description:
      'Is makinesi ve arac kullaniminda guvenli surus, devrilme/carpisma risklerinin izlenmesi ve is kazalarinin onlenmesi.',
  },
  operasyon_yonetimi: {
    label: 'Operasyon ve Is Planlama',
    legalBasis: 'KVKK m.5/2-c (sozlesmenin ifasi) ve m.5/2-f (mesru menfaat)',
    description: 'Makinelerin santiyelere sevki, calisma saatlerinin planlanmasi ve puantaj.',
  },
  hakedis_faturalama: {
    label: 'Hakedis ve Faturalama',
    legalBasis: 'KVKK m.5/2-c (sozlesmenin ifasi) ve m.5/2-a (kanunda acikca ongorulme - VUK)',
    description: 'Musteriye kesilen hakedisin calisma saatine dayali olarak hesaplanmasi ve belgelenmesi.',
  },
  varlik_guvenligi: {
    label: 'Varlik Guvenligi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    description: 'Makine hirsizligi, izinsiz kullanim ve yakit kaybinin tespiti.',
  },
  kaza_inceleme: {
    label: 'Kaza ve Olay Incelemesi',
    legalBasis: 'KVKK m.5/2-e (hakkin tesisi/kullanilmasi/korunmasi)',
    description: 'Kaza, hasar veya sigorta sureclerinde olayin aydinlatilmasi.',
  },
  bakim_arizalar: {
    label: 'Bakim ve Ariza Takibi',
    legalBasis: 'KVKK m.5/2-f (mesru menfaat)',
    description: 'Motor saati, yakit ve ariza kodlarina gore periyodik bakim planlamasi.',
  },
  hukuki_talep: {
    label: 'Hukuki Yukumluluk ve Talepler',
    legalBasis: 'KVKK m.5/2-a ve m.5/2-e',
    description: 'Resmi makam talepleri ve hukuki uyusmazliklarda delil sunumu.',
  },
};

/**
 * Hangi amac hangi veri turune erisebilir.
 * Amacla sinirlilik ilkesi kod seviyesinde burada uygulanir:
 * or. hakedis hesabi icin kabin kamerasi goruntusune erisilemez.
 */
export const PURPOSE_DATA_MATRIX: Record<ProcessingPurpose, string[]> = {
  is_guvenligi: ['position', 'session', 'event', 'camera_outward', 'camera_cabin_event'],
  operasyon_yonetimi: ['position', 'session', 'event'],
  hakedis_faturalama: ['session', 'billing', 'geofence'],
  varlik_guvenligi: ['position', 'event', 'camera_outward', 'fuel'],
  kaza_inceleme: ['position', 'session', 'event', 'camera_outward', 'camera_cabin_event', 'recording'],
  bakim_arizalar: ['session', 'fuel', 'event', 'diagnostics'],
  hukuki_talep: ['position', 'session', 'event', 'recording', 'billing', 'fuel'],
};
