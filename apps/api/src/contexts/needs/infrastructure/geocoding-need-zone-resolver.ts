import { NeedZoneResolver } from '../domain/ports/need-zone';
import { ReverseGeocode } from '../../geocoding/application/reverse-geocode';

/**
 * Adapter: needs' zone port → geocoding context's ReverseGeocode use case
 * (which rounds the point, goes through the shared Nominatim gate and cache,
 * and degrades to null).
 */
export class GeocodingNeedZoneResolver implements NeedZoneResolver {
  constructor(private readonly reverseGeocode: ReverseGeocode) {}

  async resolveZone(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const { result } = await this.reverseGeocode.resolve({
      latitude,
      longitude,
    });
    return result?.zone ?? null;
  }
}
