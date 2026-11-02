import {
  GeocodeResult,
  GeocodingProvider,
} from '../domain/ports/geocoding.provider';
import { LruTtlCache } from './lru-ttl-cache';
import { MinIntervalGate } from './min-interval-gate';

/** Shape of a single item returned by Nominatim JSON v2 */
interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

export const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
export const DEFAULT_NOMINATIM_USER_AGENT =
  'ResponseGrid/0.1 (emergency-aid-coordination)';

export type FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export interface NominatimGeocodingProviderOptions {
  /** TTL of search results (default 1 day). */
  ttlMs?: number;
  /** Upper bound on cached entries (default 1000). */
  maxCacheEntries?: number;
  /** Base URL of the Nominatim instance (no trailing slash needed). */
  baseUrl?: string;
  /**
   * User-Agent sent upstream. Nominatim's usage policy requires an
   * identifying UA, ideally with a contact (URL or e-mail).
   */
  userAgent?: string;
  /** Shared pacing gate (≥1 req/s across search + reverse). */
  gate?: MinIntervalGate;
  /** Injectable fetch (defaults to the global one, resolved lazily). */
  fetchFn?: FetchFn;
}

/**
 * Adapter that calls Nominatim (OpenStreetMap) to geocode text queries.
 *
 * Usage-policy compliance:
 * - Every upstream call goes through one {@link MinIntervalGate} (≥1100 ms
 *   apart, bounded queue/wait). When the gate turns a caller away the adapter
 *   degrades to an empty result instead of exceeding the rate.
 * - Results are cached in a bounded {@link LruTtlCache} (1 day by default), so
 *   repeated queries never reach the upstream and memory cannot grow without
 *   bound.
 * - Base URL and User-Agent are configurable so a deployment can point at its
 *   own Nominatim or identify itself with a contact address.
 */
export class NominatimGeocodingProvider implements GeocodingProvider {
  private readonly searchCache: LruTtlCache<string, GeocodeResult[]>;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly gate: MinIntervalGate;
  private readonly fetchFn: FetchFn;

  /**
   * @param ttlMsOrOptions either the search-cache TTL in ms (legacy signature)
   *   or a full options object.
   */
  constructor(ttlMsOrOptions: number | NominatimGeocodingProviderOptions = {}) {
    const options: NominatimGeocodingProviderOptions =
      typeof ttlMsOrOptions === 'number'
        ? { ttlMs: ttlMsOrOptions }
        : ttlMsOrOptions;
    const maxEntries = options.maxCacheEntries ?? 1000;
    this.searchCache = new LruTtlCache(
      maxEntries,
      options.ttlMs ?? 86_400_000 /* 1 day */,
    );
    this.baseUrl = (options.baseUrl ?? DEFAULT_NOMINATIM_BASE_URL).replace(
      /\/+$/,
      '',
    );
    this.userAgent = options.userAgent ?? DEFAULT_NOMINATIM_USER_AGENT;
    this.gate = options.gate ?? new MinIntervalGate();
    this.fetchFn =
      options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
  }

  async search(query: string): Promise<GeocodeResult[]> {
    const cached = this.searchCache.get(query);
    if (cached) return cached.value;

    const url =
      `${this.baseUrl}/search` +
      `?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(query)}`;

    const items = await this.gate.run(
      () => this.fetchJson<NominatimItem[]>(url),
      null,
    );
    // Rejected by the gate, network/parse error or non-2xx: degrade to [] and
    // do NOT cache (a transient failure must not stick for a day).
    if (items === null || !Array.isArray(items)) return [];

    const results: GeocodeResult[] = items.map((item) => ({
      address: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }));

    this.searchCache.set(query, results);
    return results;
  }

  /** GET + JSON parse; `null` on any network/HTTP/parse failure. */
  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await this.fetchFn(url, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}
