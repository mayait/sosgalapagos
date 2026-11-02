import { SearchViewbox } from '../domain/ports/geocoding.provider';

/** Bounding box used to BIAS (not restrict) a geocoding search. */
export type Viewbox = SearchViewbox;

/** BCP-47-ish language allowlist: `es`, `en`, `pt-BR`… */
const LANG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

/** Returns the language when it matches the allowlist, else `undefined`. */
export function sanitizeLang(lang: string | undefined): string | undefined {
  if (lang === undefined) return undefined;
  const trimmed = lang.trim();
  return LANG_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Parse a `west,south,east,north` viewbox. Returns `undefined` for anything
 * malformed or out of range (the search then simply runs unbiased).
 */
export function parseViewbox(raw: string | undefined): Viewbox | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => p.length === 0)) {
    return undefined;
  }
  const [west, south, east, north] = parts.map(Number);
  const lonOk = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;
  const latOk = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
  if (!lonOk(west) || !lonOk(east) || !latOk(south) || !latOk(north)) {
    return undefined;
  }
  if (!(west < east) || !(south < north)) return undefined;
  return { west, south, east, north };
}
