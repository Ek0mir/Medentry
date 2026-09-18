/**
 * Geofence (cografi cit) degerlendirme motoru.
 *
 * Sinir uzerinde GPS gurultusu nedeniyle olusan giris/cikis titremesini
 * histerezis ile onler: girise `radius`, cikisa `radius + hysteresis` esigi
 * uygulanir.
 */

import { haversineMeters, pointInPolygon, type LatLon } from '@medentry/shared';
import type { Geofence, GeofenceTransition } from '@medentry/shared';

export const DEFAULT_HYSTERESIS_M = 50;

/** Nokta citin icinde mi? `bufferM` pozitif ise cit genisletilmis sayilir. */
export function isInsideGeofence(point: LatLon, fence: Geofence, bufferM = 0): boolean {
  if (fence.kind === 'circle') {
    if (!fence.center || typeof fence.radiusM !== 'number') return false;
    return haversineMeters(point, fence.center) <= fence.radiusM + bufferM;
  }
  if (!fence.polygon || fence.polygon.length < 3) return false;
  if (pointInPolygon(point, fence.polygon)) return true;
  if (bufferM <= 0) return false;
  // Poligon disinda ama tampon icinde mi: en yakin kenara uzaklik.
  return distanceToPolygonMeters(point, fence.polygon) <= bufferM;
}

/** Noktanin poligon kenarlarina en kisa uzakligi (metre). */
export function distanceToPolygonMeters(point: LatLon, polygon: readonly LatLon[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = distanceToSegmentMeters(point, polygon[j]!, polygon[i]!);
    if (d < min) min = d;
  }
  return min;
}

function distanceToSegmentMeters(p: LatLon, a: LatLon, b: LatLon): number {
  // Kucuk mesafelerde duzlem yaklasimi yeterli.
  const latRef = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const mPerDegLat = 111_132;
  const mPerDegLon = 111_320 * Math.cos(latRef);
  const px = (p.lon - a.lon) * mPerDegLon;
  const py = (p.lat - a.lat) * mPerDegLat;
  const bx = (b.lon - a.lon) * mPerDegLon;
  const by = (b.lat - a.lat) * mPerDegLat;
  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Bir varligin hangi citlerin icinde oldugunu tutan durum. */
export type GeofenceState = ReadonlySet<string>;

export interface GeofenceEvaluation {
  transitions: GeofenceTransition[];
  state: Set<string>;
}

/**
 * Yeni bir konum icin giris/cikis olaylarini uretir.
 * `previous` bir onceki degerlendirmeden donen durumdur.
 */
export function evaluateGeofences(
  point: LatLon,
  ts: Date,
  fences: readonly Geofence[],
  previous: GeofenceState = new Set<string>(),
): GeofenceEvaluation {
  const transitions: GeofenceTransition[] = [];
  const state = new Set<string>();

  for (const fence of fences) {
    if (!fence.active) continue;
    const wasInside = previous.has(fence.id);
    const hysteresis = fence.hysteresisM ?? DEFAULT_HYSTERESIS_M;
    // Iceride sayilmak icin: giriste tam sinir, cikista tampon kadar tasma.
    const inside = wasInside
      ? isInsideGeofence(point, fence, hysteresis)
      : isInsideGeofence(point, fence, 0);

    if (inside) state.add(fence.id);
    if (inside && !wasInside) {
      transitions.push({ geofenceId: fence.id, kind: 'enter', ts, position: point });
    } else if (!inside && wasInside) {
      transitions.push({ geofenceId: fence.id, kind: 'exit', ts, position: point });
    }
  }

  return { transitions, state };
}

/**
 * Bir konum dizisi icin tum gecisleri hesaplar (gecmise donuk yeniden hesap).
 */
export function replayGeofences(
  points: readonly Array<{ ts: Date; lat: number; lon: number }>,
  fences: readonly Geofence[],
  initial: GeofenceState = new Set<string>(),
): GeofenceEvaluation {
  let state = new Set<string>(initial);
  const transitions: GeofenceTransition[] = [];
  for (const p of points) {
    const result = evaluateGeofences({ lat: p.lat, lon: p.lon }, p.ts, fences, state);
    transitions.push(...result.transitions);
    state = result.state;
  }
  return { transitions, state };
}

/**
 * Bir varligin belirli bir cit icinde gecirdigi toplam sure (saniye).
 * Hakedis "santiyede gecen sure" hesabinda kullanilir.
 */
export function timeInsideGeofence(
  transitions: readonly GeofenceTransition[],
  geofenceId: string,
  windowStart: Date,
  windowEnd: Date,
  startedInside = false,
): number {
  let total = 0;
  let enteredAt: Date | null = startedInside ? windowStart : null;

  for (const t of transitions) {
    if (t.geofenceId !== geofenceId) continue;
    if (t.ts < windowStart || t.ts > windowEnd) continue;
    if (t.kind === 'enter' && enteredAt === null) {
      enteredAt = t.ts;
    } else if (t.kind === 'exit' && enteredAt !== null) {
      total += (t.ts.getTime() - enteredAt.getTime()) / 1000;
      enteredAt = null;
    }
  }
  if (enteredAt !== null) {
    total += (windowEnd.getTime() - enteredAt.getTime()) / 1000;
  }
  return Math.max(0, total);
}

/** Konumun icinde bulundugu mahremiyet bolgelerini dondurur (KVKK maskeleme). */
export function privacyZonesFor(point: LatLon, fences: readonly Geofence[]): Geofence[] {
  return fences.filter((f) => f.active && f.purpose === 'privacy_zone' && isInsideGeofence(point, f));
}
