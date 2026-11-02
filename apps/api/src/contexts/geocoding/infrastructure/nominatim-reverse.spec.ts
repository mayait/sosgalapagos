import {
  formatReverseLabel,
  formatZoneLabel,
  NominatimGeocodingProvider,
} from './nominatim-geocoding.provider';
import { MinIntervalGate } from './min-interval-gate';

const REVERSE_BODY = {
  name: '',
  display_name:
    '12, Calle Mayor, Sol, Centro, Madrid, Comunidad de Madrid, 28013, España',
  address: {
    house_number: '12',
    road: 'Calle Mayor',
    neighbourhood: 'Sol',
    city_district: 'Centro',
    city: 'Madrid',
    state: 'Comunidad de Madrid',
    postcode: '28013',
    country: 'España',
  },
};

function okFetch(body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

const openGate = () =>
  new MinIntervalGate({ minIntervalMs: 0, sleep: () => Promise.resolve() });

describe('formatReverseLabel', () => {
  it('builds a short most-specific-first label (≤4 parts)', () => {
    expect(formatReverseLabel(REVERSE_BODY)).toBe(
      'Calle Mayor 12, Sol, Madrid, Comunidad de Madrid',
    );
  });

  it('puts a named place first', () => {
    expect(
      formatReverseLabel({
        name: 'Mercado Central',
        address: { road: 'Calle A', suburb: 'Norte', town: 'Villa' },
      }),
    ).toBe('Mercado Central, Calle A, Norte, Villa');
  });

  it('skips missing components and duplicates', () => {
    expect(
      formatReverseLabel({ address: { village: 'Aldea', state: 'Aldea' } }),
    ).toBe('Aldea');
  });

  it('falls back to the first 4 segments of display_name', () => {
    expect(
      formatReverseLabel({ display_name: 'a, b, c, d, e, f', address: {} }),
    ).toBe('a, b, c, d');
  });

  it('returns null when there is nothing usable', () => {
    expect(formatReverseLabel({})).toBeNull();
  });
});

describe('formatZoneLabel', () => {
  it('keeps only area + locality (never street or number)', () => {
    expect(formatZoneLabel(REVERSE_BODY)).toBe('Sol, Madrid');
  });

  it('falls back to the region', () => {
    expect(formatZoneLabel({ address: { state: 'Región' } })).toBe('Región');
  });

  it('is null without area components', () => {
    expect(formatZoneLabel({ address: { road: 'Calle A' } })).toBeNull();
  });
});

describe('NominatimGeocodingProvider.reverse', () => {
  it('calls /reverse with jsonv2, zoom=18, addressdetails and language', async () => {
    const fetchFn = okFetch(REVERSE_BODY);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    const result = await provider.reverse(40.4168, -3.7038, 'es');

    const [url] = fetchFn.mock.calls[0] as [string];
    expect(url).toContain('/reverse?');
    expect(url).toContain('format=jsonv2');
    expect(url).toContain('zoom=18');
    expect(url).toContain('addressdetails=1');
    expect(url).toContain('lat=40.4168');
    expect(url).toContain('lon=-3.7038');
    expect(url).toContain('accept-language=es');
    expect(result).toEqual({
      address: 'Calle Mayor 12, Sol, Madrid, Comunidad de Madrid',
      zone: 'Sol, Madrid',
    });
  });

  it('maps an {error} body to null and caches the negative result', async () => {
    const fetchFn = okFetch({ error: 'Unable to geocode' });
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    expect(await provider.reverse(0, 0)).toBeNull();
    expect(await provider.reverse(0, 0)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('caches positive results (keyed by point + language)', async () => {
    const fetchFn = okFetch(REVERSE_BODY);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    await provider.reverse(1, 2, 'es');
    await provider.reverse(1, 2, 'es');
    await provider.reverse(1, 2, 'en');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent identical lookups', async () => {
    const fetchFn = okFetch(REVERSE_BODY);
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });
    await Promise.all([provider.reverse(3, 4), provider.reverse(3, 4)]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns null and does NOT cache on transport failure', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(REVERSE_BODY),
      });
    const provider = new NominatimGeocodingProvider({
      fetchFn,
      gate: openGate(),
    });

    expect(await provider.reverse(5, 6)).toBeNull();
    expect(await provider.reverse(5, 6)).not.toBeNull();
  });

  it('shares the gate with search (one budget for both)', async () => {
    const fetchFn = okFetch(REVERSE_BODY);
    const gate = new MinIntervalGate({
      minIntervalMs: 60_000,
      maxWaitMs: 0,
      now: () => 0,
    });
    const provider = new NominatimGeocodingProvider({ fetchFn, gate });

    await provider.search('first query');
    expect(await provider.reverse(7, 8)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
