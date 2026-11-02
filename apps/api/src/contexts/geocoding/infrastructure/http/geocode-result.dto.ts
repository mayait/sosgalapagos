import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GeocodeResultDto {
  @ApiProperty({ example: 'Madrid, Community of Madrid, Spain' })
  address!: string;

  @ApiProperty({ example: 40.4165, description: 'Decimal degrees latitude' })
  latitude!: number;

  @ApiProperty({ example: -3.70256, description: 'Decimal degrees longitude' })
  longitude!: number;
}

export class ReverseGeocodeQueryDto {
  @ApiProperty({ example: 40.4168, description: 'Latitude between -90 and 90' })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    example: -3.7038,
    description: 'Longitude between -180 and 180',
  })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lon!: number;

  @ApiPropertyOptional({
    example: 'es',
    description:
      'Preferred label language (`xx` or `xx-YY`). Anything else is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lang?: string;
}

export class ReverseGeocodeResponseDto {
  @ApiProperty({
    example: 'Calle Mayor, Sol, Madrid, Comunidad de Madrid',
    nullable: true,
    type: String,
    description: 'Short label for the point, or null when nothing was found.',
  })
  address!: string | null;

  @ApiProperty({
    example: 40.4168,
    description: 'Latitude actually looked up (rounded to 4 decimals).',
  })
  latitude!: number;

  @ApiProperty({
    example: -3.7038,
    description: 'Longitude actually looked up (rounded to 4 decimals).',
  })
  longitude!: number;
}
