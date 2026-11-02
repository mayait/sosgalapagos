/**
 * Vista inicial del selector de ubicación: dónde se abre el mapa antes de que
 * la persona marque nada.
 *
 * Se calcula con los puntos públicos de la emergencia usando la mediana de
 * cada eje (resistente a puntos lejanos, p. ej. acopios en el continente) y
 * descartando los que quedan a más de `radiusKm` de esa mediana. Si no hay
 * puntos, se usa la vista por defecto configurada (`NEXT_PUBLIC_MAP_DEFAULT_VIEW`).
 */
import { distanceKm, isValidPoint, type GeoPoint } from './coordinates.ts';

export interface MapView {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface InitialViewOptions {
  /** Radio en km alrededor de la mediana para descartar puntos lejanos. */
  radiusKm?: number;
  /** Vista cuando no hay puntos utilizables. */
  fallback: MapView | null;
}

const MIN_ZOOM = 5;
const MAX_ZOOM = 15;
const SINGLE_POINT_ZOOM = 14;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Zoom que encuadra un rango en grados en un mapa de ~400 px (una tesela de
 * 256 px cubre 360° / 2^z), con un margen del 20 %.
 */
function zoomForSpan(latSpan: number, lngSpan: number, latitude: number): number {
  const lngSpanScaled = lngSpan * Math.cos((latitude * Math.PI) / 180);
  const span = Math.max(latSpan, lngSpanScaled) * 1.2;
  if (span <= 0) return SINGLE_POINT_ZOOM;
  const z = Math.floor(Math.log2((400 / 256) * (360 / span)));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function computeInitialView(
  points: readonly GeoPoint[],
  { radiusKm = 100, fallback }: InitialViewOptions,
): MapView | null {
  const valid = points.filter((p) => isValidPoint(p.latitude, p.longitude));
  if (valid.length === 0) return fallback;

  const center: GeoPoint = {
    latitude: median(valid.map((p) => p.latitude)),
    longitude: median(valid.map((p) => p.longitude)),
  };
  const near = valid.filter((p) => distanceKm(center, p) <= radiusKm);
  // La mediana de cada eje puede caer entre dos grupos sin ningún punto cerca:
  // en ese caso se usa el punto real más cercano a ella.
  const kept =
    near.length > 0
      ? near
      : [valid.reduce((best, p) => (distanceKm(center, p) < distanceKm(center, best) ? p : best))];

  if (kept.length === 1) {
    return { latitude: kept[0]!.latitude, longitude: kept[0]!.longitude, zoom: SINGLE_POINT_ZOOM };
  }

  const lats = kept.map((p) => p.latitude);
  const lngs = kept.map((p) => p.longitude);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const latitude = (south + north) / 2;
  const longitude = (west + east) / 2;
  return { latitude, longitude, zoom: zoomForSpan(north - south, east - west, latitude) };
}

/** Lee «lat,lng,zoom» (p. ej. `-0.74,-90.31,12`). `null` si no es válido. */
export function parseViewEnv(value: string | undefined | null): MapView | null {
  if (value === undefined || value === null) return null;
  const parts = value.split(',').map((s) => s.trim());
  if (parts.length !== 3 || parts.some((p) => p === '')) return null;
  const [latitude, longitude, zoom] = parts.map(Number) as [number, number, number];
  if (!isValidPoint(latitude, longitude)) return null;
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 19) return null;
  return { latitude, longitude, zoom: Math.round(zoom) };
}

/**
 * Caja «oeste,sur,este,norte» alrededor de una vista, para dar preferencia a
 * los resultados de búsqueda de la zona (no los limita).
 */
export function viewboxFor(view: MapView): string {
  const half = Math.min(10, Math.max(0.25, (360 / 2 ** view.zoom) * 2));
  const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
  const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
  const f = (v: number) => Number(v.toFixed(4)).toString();
  return [
    f(clampLng(view.longitude - half)),
    f(clampLat(view.latitude - half)),
    f(clampLng(view.longitude + half)),
    f(clampLat(view.latitude + half)),
  ].join(',');
}
