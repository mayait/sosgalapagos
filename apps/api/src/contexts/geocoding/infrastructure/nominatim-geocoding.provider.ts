import {
  GeocodeResult,
  GeocodingProvider,
  ReverseGeocodeResult,
  SearchBias,
} from '../domain/ports/geocoding.provider';
import { LruTtlCache } from './lru-ttl-cache';
import { MinIntervalGate } from './min-interval-gate';

/** Shape of a single item returned by Nominatim JSON v2 */
interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

/** Address breakdown returned with `addressdetails=1`. */
export type NominatimAddress = Partial<Record<string, string>>;

/** Shape of a Nominatim `/reverse?format=jsonv2` response. */
export interface NominatimReverseItem {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
  error?: string;
}

const STREET_KEYS = [
  'road',
  'pedestrian',
  'footway',
  'path',
  'square',
  'residential',
];
/** Area below the locality: the "zone" granularity. */
const AREA_KEYS = [
  'neighbourhood',
  'quarter',
  'suburb',
  'city_district',
  'borough',
  'hamlet',
  'isolated_dwelling',
];
const LOCALITY_KEYS = ['village', 'town', 'city', 'municipality'];
const REGION_KEYS = ['county', 'state_district', 'state'];

function firstOf(address: NominatimAddress, keys: string[]): string | null {
  for (const key of keys) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return null;
}

function uniqueParts(parts: Array<string | null>, max: number): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (out.some((p) => p.toLowerCase() === part.toLowerCase())) continue;
    out.push(part);
    if (out.length === max) break;
  }
  return out;
}

/**
 * Short, most-specific-first, comma-separated label (≤4 parts) for a reverse
 * result: `[place name], street [number], neighbourhood, locality, region`.
 * Falls back to the first 4 segments of `display_name` when the breakdown has
 * nothing usable. Returns `null` when there is nothing at all.
 */
export function formatReverseLabel(item: NominatimReverseItem): string | null {
  const address = item.address ?? {};
  const street = firstOf(address, STREET_KEYS);
  const houseNumber = address.house_number?.trim();
  const streetLine = street
    ? houseNumber
      ? `${street} ${houseNumber}`
      : street
    : null;
  const name = item.name?.trim() || null;

  const parts = uniqueParts(
    [
      name && name !== street ? name : null,
      streetLine,
      firstOf(address, AREA_KEYS),
      firstOf(address, LOCALITY_KEYS),
      firstOf(address, REGION_KEYS),
    ],
    4,
  );
  if (parts.length > 0) return parts.join(', ');

  const fallback = (item.display_name ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
  return fallback.length > 0 ? fallback.join(', ') : null;
}

/**
 * Area-level label (neighbourhood + locality, never street or house number)
 * suitable for public display as an approximate zone. `null` when the
 * breakdown has no area/locality component.
 */
export function formatZoneLabel(item: NominatimReverseItem): string | null {
  const address = item.address ?? {};
  const parts = uniqueParts(
    [firstOf(address, AREA_KEYS), firstOf(address, LOCALITY_KEYS)],
    2,
  );
  if (parts.length > 0) return parts.join(', ');
  const region = firstOf(address, REGION_KEYS);
  return region;
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
  /** TTL of reverse results, negative ones included (default 30 days). */
  reverseTtlMs?: number;
  /** Upper bound on cached entries, per cache (default 1000). */
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
  private readonly reverseCache: LruTtlCache<
    string,
    ReverseGeocodeResult | null
  >;
  /** Coalesces concurrent identical reverse lookups into one upstream call. */
  private readonly reverseInflight = new Map<
    string,
    Promise<ReverseGeocodeResult | null>
  >();
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
    this.reverseCache = new LruTtlCache(
      maxEntries,
      options.reverseTtlMs ?? 30 * 86_400_000 /* 30 days */,
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

  /**
   * Free-text search. An optional viewbox only BIASES ranking
   * (`bounded=0`): results outside it are still returned. We never send
   * `countrycodes` — emergencies cross borders and aid points can be abroad.
   */
  async search(query: string, bias?: SearchBias): Promise<GeocodeResult[]> {
    const viewbox = bias?.viewbox
      ? `${bias.viewbox.west},${bias.viewbox.south},${bias.viewbox.east},${bias.viewbox.north}`
      : '';
    const lang = bias?.lang ?? '';
    const key = `${query}|${viewbox}|${lang}`;
    const cached = this.searchCache.get(key);
    if (cached) return cached.value;

    const url =
      `${this.baseUrl}/search` +
      `?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(query)}` +
      (viewbox ? `&viewbox=${encodeURIComponent(viewbox)}&bounded=0` : '') +
      (lang ? `&accept-language=${encodeURIComponent(lang)}` : '');

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

    this.searchCache.set(key, results);
    return results;
  }

  async reverse(
    latitude: number,
    longitude: number,
    lang?: string,
  ): Promise<ReverseGeocodeResult | null> {
    const key = `${latitude},${longitude},${lang ?? ''}`;
    const cached = this.reverseCache.get(key);
    if (cached) return cached.value;

    const inflight = this.reverseInflight.get(key);
    if (inflight) return inflight;

    const pending = this.fetchReverse(key, latitude, longitude, lang).finally(
      () => this.reverseInflight.delete(key),
    );
    this.reverseInflight.set(key, pending);
    return pending;
  }

  private async fetchReverse(
    key: string,
    latitude: number,
    longitude: number,
    lang: string | undefined,
  ): Promise<ReverseGeocodeResult | null> {
    const url =
      `${this.baseUrl}/reverse?format=jsonv2&zoom=18&addressdetails=1` +
      `&lat=${encodeURIComponent(String(latitude))}` +
      `&lon=${encodeURIComponent(String(longitude))}` +
      (lang ? `&accept-language=${encodeURIComponent(lang)}` : '');

    const item = await this.gate.run(
      () => this.fetchJson<NominatimReverseItem>(url),
      null,
    );
    // Gate rejection / transport failure: no label, and NOT cached.
    if (item === null || typeof item !== 'object') return null;

    let result: ReverseGeocodeResult | null = null;
    if (item.error === undefined) {
      const address = formatReverseLabel(item);
      result = address ? { address, zone: formatZoneLabel(item) } : null;
    }
    // Upstream answered: cache positive AND negative ("nothing here") results.
    this.reverseCache.set(key, result);
    return result;
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
