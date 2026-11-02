import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, NeedStatus, PersonnelSkill } from '../../domain/need-enums';
import { LocationSensitivity } from '../../../../shared/domain/location-sensitivity';
import { SupplyLineResponseDto } from '../../../supplies/infrastructure/http/supply-line.dto';
import { AuthorResponseDto } from '../../../../shared/infrastructure/http/author.dto';
import { LocationDetailsResponseDto } from '../../../../shared/infrastructure/http/location-capture.dto';

export class CreateNeedResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id!: string;
}

export class NeedLocationResponseDto {
  @ApiPropertyOptional({
    example: 'Chacao, Caracas',
    nullable: true,
    type: String,
    description:
      'For needs with approximate location sensitivity this is ONLY a ' +
      'server-derived area label (or a generic "approximate zone" text), ' +
      'never the submitted address. Coordinators get the exact address.',
  })
  address!: string | null;

  @ApiProperty({
    example: 10.4806,
    description:
      'For approximate needs: centre of a fixed ~500 m grid cell (the same ' +
      'place always yields the same public point).',
  })
  latitude!: number;

  @ApiProperty({ example: -66.9036 })
  longitude!: number;

  @ApiPropertyOptional({
    example: 'Chacao, Caracas',
    nullable: true,
    type: String,
    description:
      'Server-derived area label (neighbourhood / locality) of the public ' +
      'point of an approximate need; null until resolved or when exact.',
  })
  zone!: string | null;
}

export class NeedViewDto {
  @ApiProperty({
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
  })
  emergencyId!: string;

  @ApiProperty({ example: 'Alimentos para 50 familias' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Descripción detallada',
    nullable: true,
    type: String,
  })
  description!: string | null;

  @ApiProperty({ type: NeedLocationResponseDto })
  location!: NeedLocationResponseDto;

  @ApiProperty({
    enum: ['public', 'approximate'],
    example: 'approximate',
    description:
      'When "approximate", the coordinates in location are snapped to a fixed grid ' +
      'cell centre for privacy (draw an area of approxRadiusMeters, not a pin). ' +
      'Coordinators always receive exact coordinates regardless of this value.',
  })
  locationSensitivity!: LocationSensitivity;

  @ApiProperty({ enum: Priority, example: Priority.High })
  priority!: Priority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  requesterOrganizationId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  managingOrganizationId!: string | null;

  @ApiProperty({ type: [SupplyLineResponseDto] })
  items!: SupplyLineResponseDto[];

  @ApiProperty({ enum: NeedStatus, example: NeedStatus.Pending })
  status!: NeedStatus;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    example: '2024-01-03T00:00:00.000Z',
    nullable: true,
    type: String,
    description:
      'Timestamp when the need expires (48 h after validation). Null for legacy needs.',
  })
  expiresAt!: string | null;

  @ApiPropertyOptional({
    example: '2024-01-01T12:00:00.000Z',
    nullable: true,
    type: String,
    description: 'Timestamp when the need was last verified by a coordinator.',
  })
  lastVerifiedAt!: string | null;

  /**
   * F05: personnel-need fields.
   * skillSpecialty is EXCLUDED from this (public) DTO — it is sensitive.
   */
  @ApiPropertyOptional({
    enum: PersonnelSkill,
    nullable: true,
    type: String,
    description: 'Required volunteer skill (personnel needs only)',
  })
  requiredSkill!: PersonnelSkill | null;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    type: Number,
    description: 'Number of personnel needed',
  })
  requestedCount!: number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'Linked resource / final recipient id (#60), or null if standalone.',
  })
  resourceId!: string | null;

  @ApiPropertyOptional({
    example: 354,
    nullable: true,
    type: Number,
    description:
      'Approximate needs only: the real location lies within this many ' +
      'metres of the public point. Null when the location is exact.',
  })
  approxRadiusMeters!: number | null;
}

/** A validated need annotated with its distance from the queried point (#57). */
export class NearbyNeedViewDto extends NeedViewDto {
  @ApiProperty({
    example: 1850,
    description:
      'Distance in meters from the queried location to the (public) need location.',
  })
  distanceMeters!: number;
}

/** Response wrapper for the "needs near me" endpoint (#57). */
export class NearbyNeedsResponseDto {
  @ApiProperty({ type: [NearbyNeedViewDto] })
  items!: NearbyNeedViewDto[];
}

/** Response wrapper for the "needs within a bounding box" map endpoint. */
export class InBoundsNeedsDto {
  @ApiProperty({ type: [NeedViewDto] })
  items!: NeedViewDto[];
}

/** Extended DTO for coordinator views — includes the sensitive skillSpecialty field. */
export class CoordinatorNeedViewDto extends NeedViewDto {
  @ApiPropertyOptional({
    example: 'Médico urgencias pediátricas',
    nullable: true,
    type: String,
    description: 'Free-text specialty detail (coordinator-only)',
  })
  skillSpecialty!: string | null;

  @ApiPropertyOptional({
    type: AuthorResponseDto,
    nullable: true,
    description:
      'Restricted contact of the real requester when filed by an integration ' +
      'on their behalf (#235). Coordinator-only — never returned publicly.',
  })
  author!: AuthorResponseDto | null;

  @ApiPropertyOptional({
    type: LocationDetailsResponseDto,
    nullable: true,
    description:
      'Restricted capture metadata of the location: private reference ' +
      '(directions), capture method and GPS accuracy bucket. ' +
      'Coordinator-only — never returned publicly.',
  })
  locationDetails!: LocationDetailsResponseDto | null;
}

export class VolunteerSuggestionDto {
  @ApiProperty({ format: 'uuid', description: 'Volunteer record ID' })
  volunteerId!: string;

  @ApiProperty({ format: 'uuid', description: 'User account ID' })
  userId!: string;

  @ApiProperty({ example: 'Ana García' })
  name!: string;

  @ApiProperty({ type: [String], description: 'All volunteer skills' })
  skills!: string[];

  @ApiProperty({ description: 'Whether the volunteer has any vehicle' })
  hasVehicle!: boolean;

  @ApiProperty({ description: 'Volunteer availability level' })
  availability!: string;
}

export class CreatedTaskFromNeedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  emergencyId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({ nullable: true, type: String, enum: PersonnelSkill })
  requiredSkill!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  linkedNeedId!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        volunteerId: { type: 'string', format: 'uuid' },
        assignedAt: { type: 'string', format: 'date-time' },
        checkedInAt: { type: 'string', format: 'date-time', nullable: true },
        checkedOutAt: { type: 'string', format: 'date-time', nullable: true },
        status: { type: 'string' },
      },
    },
  })
  assignments!: Array<{
    volunteerId: string;
    assignedAt: Date;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
    status: string;
  }>;
}
