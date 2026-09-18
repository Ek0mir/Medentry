/**
 * Cografi yardimcilar.
 *
 * Tum hesaplar WGS84 uzerinde, PostGIS bagimliligi olmadan calisir. Saha
 * mesafeleri (birkac km) icin haversine yeterli dogruluktadir; sapma < %0.5.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Iki nokta arasi buyuk cember mesafesi (metre). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a noktasindan b noktasina yon (0-360 derece, kuzey = 0). */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Nokta poligon icinde mi (ray casting).
 * Poligon [lat, lon] cifti dizisidir; kapali olmasi gerekmez.
 */
export function pointInPolygon(point: LatLon, polygon: readonly LatLon[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.lat > point.lat !== pj.lat > point.lat &&
      point.lon < ((pj.lon - pi.lon) * (point.lat - pi.lat)) / (pj.lat - pi.lat) + pi.lon;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Poligonun yaklasik alani (m2) - hakedis/alan raporlari icin. */
export function polygonAreaSqMeters(polygon: readonly LatLon[]): number {
  if (polygon.length < 3) return 0;
  const first = polygon[0]!;
  const latRef = toRad(first.lat);
  const mPerDegLat = 111_132.92 - 559.82 * Math.cos(2 * latRef) + 1.175 * Math.cos(4 * latRef);
  const mPerDegLon = 111_412.84 * Math.cos(latRef) - 93.5 * Math.cos(3 * latRef);
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const xi = (pi.lon - first.lon) * mPerDegLon;
    const yi = (pi.lat - first.lat) * mPerDegLat;
    const xj = (pj.lon - first.lon) * mPerDegLon;
    const yj = (pj.lat - first.lat) * mPerDegLat;
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
}

/** Merkezden verilen yon ve mesafede yeni nokta (simulator ve test icin). */
export function destinationPoint(from: LatLon, bearingDeg: number, distanceM: number): LatLon {
  const d = distanceM / EARTH_RADIUS_M;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 };
}

/** Bir dizi noktanin merkezi (harita odaklama icin). */
export function centroid(points: readonly LatLon[]): LatLon | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / points.length, lon: lon / points.length };
}

/** GPS koordinati gecerli mi? 0,0 (Null Island) cihaz fix alamadiginda gelir. */
export function isValidFix(p: Partial<LatLon> | null | undefined): p is LatLon {
  if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return false;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return false;
  if (Math.abs(p.lat) < 0.0001 && Math.abs(p.lon) < 0.0001) return false;
  return true;
}
