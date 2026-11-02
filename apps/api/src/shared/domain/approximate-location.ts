/**
 * Shared Kernel — Approximate Location (fixed-grid snapping).
 *
 * Pure function that coarsens exact coordinates by snapping them to the CENTRE
 * of a cell of a fixed, global grid of ~`cellMeters` × `cellMeters`.
 *
 * Why a fixed grid instead of a random/seeded offset:
 * - A per-record offset (even a deterministic one seeded by the record id)
 *   differs between records. Several requests filed from the same house each
 *   get a different offset around the same true point, so averaging them
 *   converges on the house. With a fixed grid every request from the same
 *   place maps to the SAME public point: repeated filings reveal nothing new.
 * - Nothing is seeded by the cell either: the public point is purely the cell
 *   centre, a function of the cell alone.
 *
 * Grid construction (equirectangular, accurate enough at sub-km scales):
 * - rows are bands of `cellMeters` of latitude;
 * - each row is split into columns of `cellMeters` measured at the row's
 *   centre latitude (so the cell width is constant within a row and every
 *   point of a row uses the same column boundaries).
 *
 * The true point is always within half the cell diagonal of the public point
 * ({@link approxRadiusMeters}).
 *
 * No framework/infra dependency — pure domain.
 */

/** Default cell size of the public grid for approximate locations (m). */
export const APPROX_GRID_METERS = 500;

const METERS_PER_DEGREE_LAT = 111_320;
const MIN_COS = 1e-6;

function round6(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Snap a point to the centre of its grid cell.
 *
 * @param lat        Exact latitude in degrees
 * @param lng        Exact longitude in degrees
 * @param cellMeters Cell size in metres (default {@link APPROX_GRID_METERS})
 */
export function snapToGrid(
  lat: number,
  lng: number,
  cellMeters: number = APPROX_GRID_METERS,
): { lat: number; lng: number } {
  if (!(cellMeters > 0)) {
    throw new Error('cellMeters must be a positive number');
  }
  const latStep = cellMeters / METERS_PER_DEGREE_LAT;
  const row = Math.floor((lat + 90) / latStep);
  const centerLat = Math.min(90, Math.max(-90, -90 + (row + 0.5) * latStep));

  const cos = Math.max(Math.cos((centerLat * Math.PI) / 180), MIN_COS);
  // Near the poles a cell can be wider than the whole parallel: cap at 360°.
  const lngStep = Math.min(360, cellMeters / (METERS_PER_DEGREE_LAT * cos));
  const col = Math.floor((lng + 180) / lngStep);
  let centerLng = -180 + (col + 0.5) * lngStep;
  if (centerLng > 180) centerLng -= 360;

  return { lat: round6(centerLat), lng: round6(centerLng) };
}

/**
 * Maximum distance between a true point and its public (snapped) point:
 * half the cell diagonal, rounded up. Use it to draw the public "area".
 */
export function approxRadiusMeters(
  cellMeters: number = APPROX_GRID_METERS,
): number {
  return Math.ceil((cellMeters * Math.SQRT2) / 2);
}
