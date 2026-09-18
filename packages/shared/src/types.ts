/** Platform genelinde paylasilan tip tanimlari. */

import type { LatLon } from './geo.js';

// ---------------------------------------------------------------------------
// Varlik / cihaz
// ---------------------------------------------------------------------------

/** Makine = is makinesi (ekskavator, loader...), Arac = operator pickup/kamyon. */
export type AssetCategory = 'machine' | 'vehicle';

export type AssetType =
  | 'excavator' // ekskavator
  | 'loader' // yukleyici / kepce
  | 'backhoe' // beko loder
  | 'dozer'
  | 'grader'
  | 'roller' // silindir
  | 'crane'
  | 'forklift'
  | 'truck' // kamyon
  | 'pickup' // operator araci
  | 'van'
  | 'car'
  | 'other';

export type DeviceKind = 'tracker' | 'mdvr' | 'ipcam';

/** Desteklenen cihaz protokolleri. */
export type ProtocolName = 'gt06' | 'teltonika' | 'jt808' | 'generic';

/**
 * Kamera konumu. KVKK acisindan kritik ayrim:
 *  - `cabin`  : kabin ici, calisani goruntuler -> yuksek mahremiyet sinifi
 *  - digerleri: cevreye/yola bakar -> is guvenligi ve hasar tespiti amacli
 */
export type CameraPosition =
  | 'cabin'
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'boom' // bom / calisma alani
  | 'vehicle_front'; // operator aracinin on kamerasi

export type PrivacyClass = 'standard' | 'high';

// ---------------------------------------------------------------------------
// Telemetri
// ---------------------------------------------------------------------------

/**
 * Cihaz protokolunden cozulup normalize edilmis tek bir kayit.
 * Tum protokol adaptorleri bu tipi uretir; is mantigi protokolu bilmez.
 */
export interface NormalizedRecord {
  /** Cihaz kimligi (IMEI veya terminal no). */
  deviceIdent: string;
  protocol: ProtocolName;
  /** Cihazin bildirdigi zaman (UTC). */
  timestamp: Date;
  position?: LatLon;
  /** GPS fix gecerli mi (cihaz bildirimi). */
  gpsValid: boolean;
  speedKph?: number;
  headingDeg?: number;
  altitudeM?: number;
  satellites?: number;
  hdop?: number;
  /** Kontak durumu: true = acik. Bilinmiyorsa undefined. */
  ignition?: boolean;
  /** Hareket sensoru. */
  movement?: boolean;
  odometerM?: number;
  /** Cihazin/CAN'in bildirdigi motor calisma suresi (saniye). */
  engineHoursSec?: number;
  fuelLevelPct?: number;
  fuelLevelLiters?: number;
  /** CAN uzerinden toplam tuketim (litre). */
  fuelUsedLiters?: number;
  engineRpm?: number;
  coolantTempC?: number;
  batteryV?: number;
  externalV?: number;
  gsmSignal?: number;
  /** Protokolden gelen alarm/olay kodlari. */
  alarms?: AlarmCode[];
  /** Ham veri (denetim ve hata ayiklama icin saklanir). */
  raw?: Record<string, unknown>;
}

export type AlarmCode =
  | 'sos'
  | 'power_cut'
  | 'low_battery'
  | 'vibration'
  | 'overspeed'
  | 'harsh_acceleration'
  | 'harsh_braking'
  | 'harsh_cornering'
  | 'crash'
  | 'tow'
  | 'jamming'
  | 'gps_lost'
  | 'geofence_in'
  | 'geofence_out'
  | 'fuel_drop'
  | 'idle'
  | 'unknown';

/** Veritabanindan okunan konum kaydi (is mantigi girdisi). */
export interface PositionSample {
  id?: number;
  assetId: string;
  ts: Date;
  lat: number;
  lon: number;
  speedKph: number;
  headingDeg?: number;
  ignition?: boolean;
  movement?: boolean;
  odometerM?: number;
  engineHoursSec?: number;
  fuelLevelPct?: number;
  fuelLevelLiters?: number;
  externalV?: number;
}

// ---------------------------------------------------------------------------
// Calisma / puantaj
// ---------------------------------------------------------------------------

export interface WorkSession {
  assetId: string;
  startedAt: Date;
  endedAt: Date | null;
  /** Kontak acik gecen toplam sure. */
  durationSec: number;
  /** Bu surenin rolanti (calisma yapmadan motor acik) kismi. */
  idleSec: number;
  /** durationSec - idleSec: faturalanabilir efektif calisma. */
  workingSec: number;
  distanceM: number;
  startPosition?: LatLon;
  endPosition?: LatLon;
  fuelStartPct?: number;
  fuelEndPct?: number;
  fuelUsedLiters?: number;
  /** Oturum hala acik mi (kontak kapanmadi). */
  open: boolean;
}

export interface IdlePeriod {
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  position?: LatLon;
}

// ---------------------------------------------------------------------------
// Geofence
// ---------------------------------------------------------------------------

export type GeofenceKind = 'circle' | 'polygon';

/**
 * `purpose` alani KVKK amacla sinirlilik ilkesi icin onemlidir:
 * `privacy_zone` icindeki konumlar maskelenir (or. operatorun evi).
 */
export type GeofencePurpose = 'worksite' | 'depot' | 'restricted' | 'privacy_zone' | 'customer';

export interface Geofence {
  id: string;
  name: string;
  kind: GeofenceKind;
  purpose: GeofencePurpose;
  center?: LatLon;
  radiusM?: number;
  polygon?: LatLon[];
  /** Sinir titremesini engelleyen tampon (metre). */
  hysteresisM?: number;
  active: boolean;
}

export interface GeofenceTransition {
  geofenceId: string;
  kind: 'enter' | 'exit';
  ts: Date;
  position: LatLon;
}

// ---------------------------------------------------------------------------
// Yakit
// ---------------------------------------------------------------------------

export interface FuelEvent {
  assetId: string;
  ts: Date;
  kind: 'fill' | 'drop';
  liters: number;
  levelBeforePct: number;
  levelAfterPct: number;
  position?: LatLon;
  /** 0-1 arasi guven skoru; dusuk skorlu olaylar uyari uretmez. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Hakedis
// ---------------------------------------------------------------------------

export type PricingMode = 'hourly' | 'daily' | 'hourly_with_min' | 'monthly';

export interface RateCard {
  id: string;
  name: string;
  currency: string;
  mode: PricingMode;
  /** Saat basi birim fiyat. */
  hourlyRate?: number;
  /** Gunluk goturu bedel. */
  dailyRate?: number;
  /** Gunluk asgari faturalanabilir saat (or. 8 saat garanti). */
  minHoursPerDay?: number;
  /** Bu saatten sonrasi mesai sayilir. */
  overtimeAfterHours?: number;
  /** Mesai carpani (or. 1.5). */
  overtimeMultiplier?: number;
  /** Rolanti suresi faturalanir mi? */
  idleBillable: boolean;
  /** Rolanti icin farkli saat ucreti (bos ise hourlyRate kullanilir). */
  idleHourlyRate?: number;
  /** Gunluk sabit nakliye/mobilizasyon bedeli. */
  transportFee?: number;
  /** Yakit fiyata dahil mi? Degilse tuketim musteriye yansitilir. */
  fuelIncluded: boolean;
  fuelPricePerLiter?: number;
  /** KDV orani (0.20 = %20). */
  vatRate?: number;
  /** Faturalanabilir saat yuvarlama adimi (saat). 0.25 = 15 dk. */
  roundingStepHours?: number;
  /** Yuvarlama yonu. Makine kiralamada sozlesme geregi cogunlukla yukari. */
  roundingMode?: 'up' | 'nearest' | 'down';
  /** Aylik kira bedeli (mode = 'monthly'). */
  monthlyRate?: number;
  /** Aylik kirada prorata icin ay icindeki calisma gunu sayisi (varsayilan 26). */
  workingDaysPerMonth?: number;
}

export interface DailyBilling {
  assetId: string;
  dateKey: string;
  rateCardId: string;
  currency: string;
  engineHours: number;
  workingHours: number;
  idleHours: number;
  billableHours: number;
  normalHours: number;
  overtimeHours: number;
  amountBase: number;
  amountOvertime: number;
  amountIdle: number;
  amountTransport: number;
  amountFuel: number;
  /** KDV haric toplam. */
  amountNet: number;
  amountVat: number;
  amountTotal: number;
  fuelUsedLiters: number;
  /** Hesabin nasil olustugunu aciklayan satirlar (fatura eki / seffaflik). */
  lines: BillingLine[];
}

export interface BillingLine {
  code: string;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

// ---------------------------------------------------------------------------
// KVKK
// ---------------------------------------------------------------------------

/** Rol tabanli erisim. `dpo` = KVKK irtibat kisisi / veri sorumlusu temsilcisi. */
export type UserRole = 'owner' | 'manager' | 'site_chief' | 'operator' | 'viewer' | 'dpo';

/**
 * Isleme amaclari. Her veri erisimi bir amaca baglanir; amac disi erisim
 * API seviyesinde reddedilir (amacla sinirlilik - KVKK m.4/2-c).
 */
export type ProcessingPurpose =
  | 'is_guvenligi' // is sagligi ve guvenligi
  | 'operasyon_yonetimi' // is planlama, sevkiyat
  | 'hakedis_faturalama' // musteri hakedisi
  | 'varlik_guvenligi' // hirsizlik, hasar
  | 'kaza_inceleme' // kaza/olay sonrasi inceleme
  | 'bakim_arizalar' // bakim ve ariza takibi
  | 'hukuki_talep'; // hukuki yukumluluk / talep

export interface AuditEntry {
  userId: string;
  ts: Date;
  action: string;
  purpose: ProcessingPurpose;
  reason?: string;
  assetId?: string;
  subjectUserId?: string;
  ip?: string;
  userAgent?: string;
  result: 'allow' | 'deny';
}

/**
 * Mahremiyet penceresi: bu araliklarda kamera/konum verisi maskelenir.
 * Mola, vardiya disi ve ozel kullanim icin kullanilir.
 */
export interface PrivacyWindow {
  id: string;
  assetId?: string | null;
  kind: 'break' | 'off_shift' | 'private_use';
  /** Haftanin gunleri (1=Pzt..7=Paz). Bos ise her gun. */
  weekdays?: number[];
  /** Yerel saatte "HH:MM". */
  startTime?: string;
  endTime?: string;
  /** Tek seferlik pencere icin mutlak aralik. */
  startsAt?: Date;
  endsAt?: Date;
  active: boolean;
}
