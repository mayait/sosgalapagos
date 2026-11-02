import { Module } from '@nestjs/common';
import {
  GEOCODING_PROVIDER,
  GeocodingProvider,
} from '../domain/ports/geocoding.provider';
import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';
import { MinIntervalGate } from './min-interval-gate';
import { SearchAddress } from '../application/search-address';
import { ReverseGeocode } from '../application/reverse-geocode';
import { GeocodingController } from './http/geocoding.controller';

/**
 * One provider instance per process ⇒ one shared {@link MinIntervalGate} for
 * every outbound Nominatim call (search + reverse), as its usage policy
 * requires (≤1 req/s for the whole application).
 *
 * Env:
 * - `NOMINATIM_BASE_URL`   — own/alternative Nominatim instance (optional).
 * - `NOMINATIM_USER_AGENT` — identifying UA with a contact, e.g.
 *   `MyDeployment/1.0 (ops@example.org)` (optional, recommended).
 */
const nominatimProvider = {
  provide: GEOCODING_PROVIDER,
  useFactory: (): GeocodingProvider => {
    const baseUrl = process.env.NOMINATIM_BASE_URL?.trim();
    const userAgent = process.env.NOMINATIM_USER_AGENT?.trim();
    return new NominatimGeocodingProvider({
      gate: new MinIntervalGate({
        minIntervalMs: 1100,
        maxQueue: 8,
        maxWaitMs: 6000,
      }),
      ...(baseUrl ? { baseUrl } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
  },
};

const searchAddressProvider = {
  provide: SearchAddress,
  inject: [GEOCODING_PROVIDER],
  useFactory: (provider: GeocodingProvider) => new SearchAddress(provider),
};

const reverseGeocodeProvider = {
  provide: ReverseGeocode,
  inject: [GEOCODING_PROVIDER],
  useFactory: (provider: GeocodingProvider) => new ReverseGeocode(provider),
};

@Module({
  controllers: [GeocodingController],
  providers: [nominatimProvider, searchAddressProvider, reverseGeocodeProvider],
  exports: [GEOCODING_PROVIDER, ReverseGeocode],
})
export class GeocodingModule {}
