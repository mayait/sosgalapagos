import {
  InvalidReverseGeocodeQueryError,
  ReverseGeocode,
  roundCoordinate,
  sanitizeLang,
} from './reverse-geocode';
import {
  GeocodingProvider,
  ReverseGeocodeResult,
} from '../domain/ports/geocoding.provider';

class FakeProvider implements GeocodingProvider {
  readonly calls: Array<[number, number, string | undefined]> = [];
  constructor(
    private readonly answer: ReverseGeocodeResult | null | Error = {
      address: 'Calle Mayor, Sol, Madrid',
      zone: 'Sol, Madrid',
    },
  ) {}
  search(): Promise<never[]> {
    return Promise.resolve([]);
  }
  reverse(lat: number, lon: number, lang?: string) {
    this.calls.push([lat, lon, lang]);
    if (this.answer instanceof Error) return Promise.reject(this.answer);
    return Promise.resolve(this.answer);
  }
}

describe('ReverseGeocode', () => {
  it('rounds to 4 decimals BEFORE calling the provider', async () => {
    const provider = new FakeProvider();
    const useCase = new ReverseGeocode(provider);

    const view = await useCase.execute({
      latitude: 40.416775123,
      longitude: -3.703790987,
    });

    expect(provider.calls).toEqual([[40.4168, -3.7038, undefined]]);
    expect(view).toEqual({
      address: 'Calle Mayor, Sol, Madrid',
      latitude: 40.4168,
      longitude: -3.7038,
    });
  });

  it('returns address null (not an error) when nothing is found', async () => {
    const useCase = new ReverseGeocode(new FakeProvider(null));
    const view = await useCase.execute({ latitude: 0, longitude: 0 });
    expect(view.address).toBeNull();
  });

  it('returns address null when the provider throws', async () => {
    const useCase = new ReverseGeocode(new FakeProvider(new Error('boom')));
    const view = await useCase.execute({ latitude: 1, longitude: 1 });
    expect(view.address).toBeNull();
  });

  it.each([
    [91, 0],
    [-91, 0],
    [0, 181],
    [0, -181],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
  ])('rejects out-of-range coordinates (%p, %p)', async (lat, lon) => {
    const provider = new FakeProvider();
    const useCase = new ReverseGeocode(provider);
    await expect(
      useCase.execute({ latitude: lat, longitude: lon }),
    ).rejects.toBeInstanceOf(InvalidReverseGeocodeQueryError);
    expect(provider.calls).toHaveLength(0);
  });

  it('passes allowlisted languages and drops anything else', async () => {
    const provider = new FakeProvider();
    const useCase = new ReverseGeocode(provider);
    await useCase.execute({ latitude: 1, longitude: 1, lang: 'pt-BR' });
    await useCase.execute({ latitude: 1, longitude: 1, lang: 'es&x=1' });
    expect(provider.calls.map((c) => c[2])).toEqual(['pt-BR', undefined]);
  });

  it('resolve() exposes the area-level zone for server-side use', async () => {
    const useCase = new ReverseGeocode(new FakeProvider());
    const { result } = await useCase.resolve({ latitude: 1, longitude: 1 });
    expect(result?.zone).toBe('Sol, Madrid');
  });
});

describe('roundCoordinate / sanitizeLang', () => {
  it('normalises -0', () => {
    expect(Object.is(roundCoordinate(-0.00001), 0)).toBe(true);
  });

  it.each(['es', 'en', 'pt-BR'])('accepts %s', (lang) => {
    expect(sanitizeLang(lang)).toBe(lang);
  });

  it.each(['ES', 'spa', 'es-br', 'es_ES', '', 'es-ES;q=0.9'])(
    'rejects %p',
    (lang) => {
      expect(sanitizeLang(lang)).toBeUndefined();
    },
  );
});
