import {
  GeocodingProvider,
  ReverseGeocodeResult,
} from '../domain/ports/geocoding.provider';
import { sanitizeLang } from './geocode-params';

export interface ReverseGeocodeQuery {
  latitude: number;
  longitude: number;
  lang?: string | undefined;
}

export interface ReverseGeocodeView {
  address: string | null;
  /** Coordinates as sent upstream (rounded to {@link REVERSE_DECIMALS}). */
  latitude: number;
  longitude: number;
}

export class InvalidReverseGeocodeQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReverseGeocodeQueryError';
  }
}

/**
 * Decimals kept before calling the third-party geocoder: 4 decimals ≈ 11 m.
 * Enough to label the place, while never handing the exact GPS fix to a
 * third party (and it makes nearby lookups share one cache entry).
 */
export const REVERSE_DECIMALS = 4;

export function roundCoordinate(value: number, decimals = REVERSE_DECIMALS) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  // Normalise -0 to 0 so it never leaks into URLs / cache keys as "-0".
  return rounded === 0 ? 0 : rounded;
}

export { sanitizeLang };

function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new InvalidReverseGeocodeQueryError(
      'latitude must be a number between -90 and 90',
    );
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new InvalidReverseGeocodeQueryError(
      'longitude must be a number between -180 and 180',
    );
  }
}

/**
 * Reverse-geocode a point into a short human label.
 *
 * - Validates ranges (throws {@link InvalidReverseGeocodeQueryError}).
 * - Rounds to {@link REVERSE_DECIMALS} BEFORE calling the provider.
 * - Unknown/invalid languages are dropped (provider default applies).
 * - Never fails because of the upstream: no label ⇒ `address: null`.
 */
export class ReverseGeocode {
  constructor(private readonly provider: GeocodingProvider) {}

  async execute(query: ReverseGeocodeQuery): Promise<ReverseGeocodeView> {
    const result = await this.resolve(query);
    return {
      address: result.result?.address ?? null,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  /**
   * Same as {@link execute} but returns the full provider result (including
   * the area-level `zone`), for server-side consumers.
   */
  async resolve(query: ReverseGeocodeQuery): Promise<{
    result: ReverseGeocodeResult | null;
    latitude: number;
    longitude: number;
  }> {
    assertCoordinates(query.latitude, query.longitude);
    const latitude = roundCoordinate(query.latitude);
    const longitude = roundCoordinate(query.longitude);
    const lang = sanitizeLang(query.lang);

    let result: ReverseGeocodeResult | null;
    try {
      result = await this.provider.reverse(latitude, longitude, lang);
    } catch {
      result = null;
    }
    return { result, latitude, longitude };
  }
}
