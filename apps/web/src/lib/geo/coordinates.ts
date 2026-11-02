/**
 * Utilidades mínimas de coordenadas, sin dependencias (se usan en el cliente,
 * en el servidor y en los tests de `node --test`).
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Un punto válido: números finitos, dentro de rango y distinto de (0, 0). */
export function isValidPoint(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // (0, 0) es «Null Island»: casi siempre un valor por defecto, no un lugar real.
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

const EARTH_RADIUS_KM = 6371;

/** Distancia en kilómetros entre dos puntos (haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Redondea a `decimals` decimales (4 ≈ 11 m). */
export function roundCoord(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
