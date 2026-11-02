export const GEOCODING_PROVIDER = Symbol('GeocodingProvider');

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

/** Result of reverse-geocoding a point. */
export interface ReverseGeocodeResult {
  /** Short, most-specific-first label (street, neighbourhood, locality…). */
  address: string;
  /**
   * Coarse, area-level label (neighbourhood / locality) with no street or
   * house number — safe to show publicly as "approximate zone". Null when the
   * upstream returned no area-level component.
   */
  zone: string | null;
}

export interface GeocodingProvider {
  search(query: string): Promise<GeocodeResult[]>;
  /**
   * Reverse-geocode a point. Resolves `null` when nothing is found OR the
   * upstream is unavailable — callers must treat it as "no label".
   * Callers are responsible for coarsening the coordinates beforehand.
   */
  reverse(
    latitude: number,
    longitude: number,
    lang?: string,
  ): Promise<ReverseGeocodeResult | null>;
}
