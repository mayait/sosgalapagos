import { SearchAddress } from './search-address';
import {
  GeocodeResult,
  GeocodingProvider,
} from '../domain/ports/geocoding.provider';

class FakeGeocodingProvider implements GeocodingProvider {
  readonly calls: string[] = [];
  private readonly fixture: GeocodeResult[];

  constructor(fixture: GeocodeResult[] = []) {
    this.fixture = fixture;
  }

  search(query: string): Promise<GeocodeResult[]> {
    this.calls.push(query);
    return Promise.resolve(this.fixture);
  }

  reverse(): Promise<null> {
    return Promise.resolve(null);
  }
}

const FIXTURE: GeocodeResult[] = [
  { address: 'Madrid, Spain', latitude: 40.4168, longitude: -3.7038 },
  {
    address: 'Madrid, Cundinamarca, Colombia',
    latitude: 4.7319,
    longitude: -74.2641,
  },
];

describe('SearchAddress', () => {
  it('delegates to provider and returns results', async () => {
    const provider = new FakeGeocodingProvider(FIXTURE);
    const useCase = new SearchAddress(provider);

    const results = await useCase.execute({ query: 'Madrid' });

    expect(results).toEqual(FIXTURE);
    expect(provider.calls).toEqual(['Madrid']);
  });

  it('returns [] without calling provider when query is shorter than 3 chars', async () => {
    const provider = new FakeGeocodingProvider(FIXTURE);
    const useCase = new SearchAddress(provider);

    const results = await useCase.execute({ query: 'ab' });

    expect(results).toEqual([]);
    expect(provider.calls).toHaveLength(0);
  });

  it('returns [] for empty query', async () => {
    const provider = new FakeGeocodingProvider(FIXTURE);
    const useCase = new SearchAddress(provider);

    const results = await useCase.execute({ query: '' });

    expect(results).toEqual([]);
    expect(provider.calls).toHaveLength(0);
  });

  it('returns [] for whitespace-only query', async () => {
    const provider = new FakeGeocodingProvider(FIXTURE);
    const useCase = new SearchAddress(provider);

    const results = await useCase.execute({ query: '  ' });

    expect(results).toEqual([]);
    expect(provider.calls).toHaveLength(0);
  });

  it('trims surrounding whitespace before calling provider', async () => {
    const provider = new FakeGeocodingProvider(FIXTURE);
    const useCase = new SearchAddress(provider);

    await useCase.execute({ query: '  Madrid  ' });

    expect(provider.calls).toEqual(['Madrid']);
  });

  it('returns [] when provider returns empty array', async () => {
    const provider = new FakeGeocodingProvider([]);
    const useCase = new SearchAddress(provider);

    const results = await useCase.execute({ query: 'Nowhere' });

    expect(results).toEqual([]);
  });
});
