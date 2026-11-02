import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';
import { MinIntervalGate } from './min-interval-gate';

const NOMINATIM_RESPONSE = [
  {
    display_name: 'Madrid, Community of Madrid, Spain',
    lat: '40.41650',
    lon: '-3.70256',
  },
  {
    display_name: 'Madrid, Cundinamarca, Colombia',
    lat: '4.73191',
    lon: '-74.26411',
  },
];

function makeFetchMock(
  body: unknown,
  options: { ok?: boolean; status?: number; throws?: boolean } = {},
): jest.Mock {
  if (options.throws) {
    return jest.fn().mockRejectedValue(new Error('Network failure'));
  }
  return jest.fn().mockResolvedValue({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: () => Promise.resolve(body),
  });
}

describe('NominatimGeocodingProvider', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps Nominatim response items to GeocodeResult', async () => {
    global.fetch = makeFetchMock(NOMINATIM_RESPONSE) as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    const results = await provider.search('Madrid');

    expect(results).toEqual([
      {
        address: 'Madrid, Community of Madrid, Spain',
        latitude: 40.4165,
        longitude: -3.70256,
      },
      {
        address: 'Madrid, Cundinamarca, Colombia',
        latitude: 4.73191,
        longitude: -74.26411,
      },
    ]);
  });

  it('sends the required User-Agent header', async () => {
    const mockFetch = makeFetchMock(NOMINATIM_RESPONSE);
    global.fetch = mockFetch as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    await provider.search('Sevilla');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      'ResponseGrid/0.1 (emergency-aid-coordination)',
    );
  });

  it('includes query in the URL', async () => {
    const mockFetch = makeFetchMock(NOMINATIM_RESPONSE);
    global.fetch = mockFetch as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    await provider.search('Barcelona');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('q=Barcelona');
    expect(url).toContain('format=jsonv2');
    expect(url).toContain('limit=5');
  });

  it('returns [] when fetch throws (network error)', async () => {
    global.fetch = makeFetchMock(null, { throws: true }) as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    const results = await provider.search('Valencia');

    expect(results).toEqual([]);
  });

  it('returns [] when Nominatim responds with non-2xx status', async () => {
    global.fetch = makeFetchMock(null, {
      ok: false,
      status: 429,
    }) as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    const results = await provider.search('Bilbao');

    expect(results).toEqual([]);
  });

  it('returns [] when Nominatim returns an empty array', async () => {
    global.fetch = makeFetchMock([]) as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    const results = await provider.search('Xyzzy');

    expect(results).toEqual([]);
  });

  it('serves subsequent identical queries from cache (no second fetch)', async () => {
    const mockFetch = makeFetchMock(NOMINATIM_RESPONSE);
    global.fetch = mockFetch as typeof global.fetch;

    const provider = new NominatimGeocodingProvider();
    await provider.search('Malaga');
    await provider.search('Malaga'); // should hit cache

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expires', async () => {
    const mockFetch = makeFetchMock(NOMINATIM_RESPONSE);
    global.fetch = mockFetch as typeof global.fetch;

    // TTL of 0 ms means every call is expired
    const provider = new NominatimGeocodingProvider(0);
    await provider.search('Zaragoza');
    await provider.search('Zaragoza');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('NominatimGeocodingProvider — configuration & usage policy', () => {
  const openGate = () =>
    new MinIntervalGate({ minIntervalMs: 0, sleep: () => Promise.resolve() });

  it('uses the configured base URL and User-Agent', async () => {
    const fetchFn = makeFetchMock(NOMINATIM_RESPONSE);
    const provider = new NominatimGeocodingProvider({
      baseUrl: 'https://geo.example.org/',
      userAgent: 'MyDeploy/1.0 (ops@example.org)',
      fetchFn,
      gate: openGate(),
    });

    await provider.search('Quito');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('https://geo.example.org/search?')).toBe(true);
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      'MyDeploy/1.0 (ops@example.org)',
    );
  });

  it('degrades to [] without calling upstream when the gate rejects', async () => {
    const fetchFn = makeFetchMock(NOMINATIM_RESPONSE);
    const gate = new MinIntervalGate({
      minIntervalMs: 60_000,
      maxWaitMs: 0,
      now: () => 0,
    });
    const provider = new NominatimGeocodingProvider({ fetchFn, gate });

    await provider.search('first'); // takes the free slot
    const results = await provider.search('second');

    expect(results).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => null })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(NOMINATIM_RESPONSE),
      });
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    expect(await provider.search('Loja')).toEqual([]);
    expect(await provider.search('Loja')).toHaveLength(2);
  });

  it('bounds the cache (LRU eviction)', async () => {
    const fetchFn = makeFetchMock(NOMINATIM_RESPONSE);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
      maxCacheEntries: 1,
    });

    await provider.search('one');
    await provider.search('two'); // evicts "one"
    await provider.search('one');

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('sends the viewbox as a bias (bounded=0) and never countrycodes', async () => {
    const fetchFn = makeFetchMock(NOMINATIM_RESPONSE);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    await provider.search('Mercado', {
      viewbox: { west: -3.8, south: 40.35, east: -3.6, north: 40.5 },
      lang: 'es',
    });

    const [url] = fetchFn.mock.calls[0] as [string];
    expect(url).toContain(
      `viewbox=${encodeURIComponent('-3.8,40.35,-3.6,40.5')}`,
    );
    expect(url).toContain('bounded=0');
    expect(url).toContain('accept-language=es');
    expect(url).not.toContain('countrycodes');
  });

  it('keys the cache by query + viewbox + language', async () => {
    const fetchFn = makeFetchMock(NOMINATIM_RESPONSE);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });
    const viewbox = { west: 0, south: 0, east: 1, north: 1 };

    await provider.search('Mercado');
    await provider.search('Mercado', { viewbox });
    await provider.search('Mercado', { viewbox, lang: 'en' });
    await provider.search('Mercado', { viewbox, lang: 'en' });

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
