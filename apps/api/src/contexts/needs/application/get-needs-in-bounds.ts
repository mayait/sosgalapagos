import { NeedRepository } from '../domain/ports/need.repository';
import { NeedZoneQueue } from '../domain/ports/need-zone';
import { EmergencyId } from '../../../shared/domain/emergency-id';
import { approxRadiusMeters } from '../../../shared/domain/approximate-location';
import { NeedView, toPublicNeedView } from './need-view';
import { scheduleMissingZones } from './resolve-need-zone';

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * GetNeedsInBounds — validated needs inside a map viewport bounding box.
 *
 * Mirrors GetResourcesInBounds so the map can load needs for the visible area
 * only (and stay fast when there are hundreds of needs).
 *
 * Privacy: the box is matched against the PUBLIC point of each need (the grid
 * cell centre for approximate needs), not the stored exact one. Otherwise a
 * caller could shrink the box until a need disappears and recover its exact
 * position. The repository is queried with the box widened by the maximum
 * public displacement, then filtered on the public point.
 */
export class GetNeedsInBounds {
  constructor(
    private readonly repo: NeedRepository,
    private readonly zoneQueue?: NeedZoneQueue,
  ) {}

  async execute(q: {
    emergencyId: string;
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
    limit: number;
  }): Promise<{ items: NeedView[] }> {
    const margin = approxRadiusMeters();
    const latMargin = margin / METERS_PER_DEGREE_LAT;
    const maxAbsLat = Math.min(
      89,
      Math.max(Math.abs(q.minLat), Math.abs(q.maxLat)) + latMargin,
    );
    const lngMargin =
      margin / (METERS_PER_DEGREE_LAT * Math.cos((maxAbsLat * Math.PI) / 180));

    const needs = await this.repo.findValidatedInBounds(
      EmergencyId.fromString(q.emergencyId),
      {
        minLat: Math.max(-90, q.minLat - latMargin),
        minLng: Math.max(-180, q.minLng - lngMargin),
        maxLat: Math.min(90, q.maxLat + latMargin),
        maxLng: Math.min(180, q.maxLng + lngMargin),
        limit: q.limit,
      },
    );
    scheduleMissingZones(this.zoneQueue, needs);

    const items = needs
      .map((n) => toPublicNeedView(n))
      .filter(
        (v) =>
          v.location.latitude >= q.minLat &&
          v.location.latitude <= q.maxLat &&
          v.location.longitude >= q.minLng &&
          v.location.longitude <= q.maxLng,
      )
      .slice(0, q.limit);
    return { items };
  }
}
