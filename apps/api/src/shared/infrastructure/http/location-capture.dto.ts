import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  LOCATION_ACCURACY_BUCKETS,
  LOCATION_METHODS,
  LOCATION_REFERENCE_MAX_LENGTH,
} from '../../domain/location-capture';
import type {
  LocationAccuracyBucket,
  LocationMethod,
} from '../../domain/location-capture';

/**
 * Optional capture metadata accepted inside a `location` input object (need,
 * resource, donation offer). Extended by each context's location input DTO.
 *
 * `reference` is PRIVATE (coordinators/owners only, never public).
 * When `method` is `gps|map|search|link`, `address` is expected to be the
 * geocoder label of the point; free-text directions belong in `reference`.
 */
export class LocationCaptureInputDto {
  @ApiPropertyOptional({
    example: 'Portón verde detrás de la escuela',
    maxLength: LOCATION_REFERENCE_MAX_LENGTH,
    description:
      'PRIVATE directions to reach the point. Only coordinators/owners can ' +
      'read it; it is never returned by anonymous/public endpoints.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(LOCATION_REFERENCE_MAX_LENGTH)
  reference?: string;

  @ApiPropertyOptional({
    enum: LOCATION_METHODS,
    example: 'map',
    description:
      'How the point was set: device GPS, picked on the map, a search ' +
      'result, a pasted link, or only an approximate zone.',
  })
  @IsOptional()
  @IsIn(LOCATION_METHODS)
  method?: LocationMethod;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    description:
      'GPS accuracy in metres. Stored only as a bucket (<50, 50-200, >200).',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  accuracyM?: number;
}

/** Restricted view of the capture metadata (coordinators/owners only). */
export class LocationDetailsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Private directions to reach the point.',
  })
  reference!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: LOCATION_METHODS,
    type: String,
  })
  method!: LocationMethod | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: LOCATION_ACCURACY_BUCKETS,
    type: String,
    description: 'GPS accuracy bucket in metres.',
  })
  accuracy!: LocationAccuracyBucket | null;
}

/** Map the optional input fields to the domain `LocationCaptureInput`. */
export function toLocationCaptureInput(dto: LocationCaptureInputDto): {
  reference: string | null;
  method: LocationMethod | null;
  accuracyM: number | null;
} {
  return {
    reference: dto.reference ?? null,
    method: dto.method ?? null,
    accuracyM: dto.accuracyM ?? null,
  };
}
