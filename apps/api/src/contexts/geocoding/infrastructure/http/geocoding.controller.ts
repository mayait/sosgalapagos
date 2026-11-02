import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SearchAddress } from '../../application/search-address';
import {
  InvalidReverseGeocodeQueryError,
  ReverseGeocode,
  ReverseGeocodeView,
} from '../../application/reverse-geocode';
import {
  GeocodeResultDto,
  ReverseGeocodeQueryDto,
  ReverseGeocodeResponseDto,
} from './geocode-result.dto';
import { GeocodeResult } from '../../domain/ports/geocoding.provider';

@ApiTags('geocoding')
@Controller('geocode')
export class GeocodingController {
  constructor(
    private readonly searchAddress: SearchAddress,
    private readonly reverseGeocode: ReverseGeocode,
  ) {}

  @Get()
  // This endpoint proxies an unauthenticated free-text query to the external
  // Nominatim service, whose usage policy forbids heavy automated traffic.
  // A tight per-IP cap protects both our API (DoS) and our upstream reputation
  // (getting the server IP banned would break geocoding for everyone).
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Geocode a free-text address query (Nominatim / OpenStreetMap)',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiQuery({
    name: 'q',
    description: 'Address or place name to search',
    example: 'Madrid',
  })
  @ApiQuery({
    name: 'viewbox',
    required: false,
    description:
      'Bias results towards this box: `west,south,east,north` in degrees. ' +
      'A preference only (results outside are still returned). Ignored when ' +
      'malformed.',
    example: '-3.80,40.35,-3.60,40.50',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description:
      'Preferred label language (`xx` or `xx-YY`). Anything else is ignored.',
    example: 'es',
  })
  @ApiOkResponse({
    description:
      'Geocoding results (empty array when query is shorter than 3 characters)',
    type: GeocodeResultDto,
    isArray: true,
  })
  async search(
    @Query('q') q = '',
    @Query('viewbox') viewbox?: string,
    @Query('lang') lang?: string,
  ): Promise<GeocodeResult[]> {
    return this.searchAddress.execute({
      query: typeof q === 'string' ? q : '',
      viewbox: typeof viewbox === 'string' ? viewbox : undefined,
      lang: typeof lang === 'string' ? lang : undefined,
    });
  }

  @Get('reverse')
  // Same upstream as search; 30/min per client is plenty for a picker that
  // only asks when the user stops moving the map (results are cached 30 days).
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Reverse-geocode a point into a short label',
    description:
      'Coordinates are rounded to 4 decimals (~11 m) before being sent to ' +
      'the third-party geocoder. Always 200: `address` is null when nothing ' +
      'was found or the geocoder is unavailable.',
  })
  @ApiOkResponse({ type: ReverseGeocodeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid lat/lon' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async reverse(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<ReverseGeocodeView> {
    try {
      return await this.reverseGeocode.execute({
        latitude: query.lat,
        longitude: query.lon,
        lang: query.lang,
      });
    } catch (error) {
      if (error instanceof InvalidReverseGeocodeQueryError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
