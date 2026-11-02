import { NeedRepository } from '../domain/ports/need.repository';
import { NeedZoneQueue } from '../domain/ports/need-zone';
import { EmergencyId } from '../../../shared/domain/emergency-id';
import { haversineMeters } from '../../../shared/domain/geo-distance';
import { approxRadiusMeters } from '../../../shared/domain/approximate-location';
import { NeedView, toPublicNeedView } from './need-view';
import { scheduleMissingZones } from './resolve-need-zone';

export interface NearbyNeedView extends NeedView {
  distanceMeters: number;
}

export interface GetNearbyNeedsQuery {
  emergencyId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}

/**
 * Returns validated needs near a citizen's (ephemeral) location, ordered by
 * proximity (#57).
 *
 * Privacy: everything the caller can observe — membership in the radius, the
 * distance AND the ordering — is derived from the PUBLIC point of each need
 * (grid cell centre for approximate needs). The repository is queried with the
 * radius widened by the maximum public displacement, then results are filtered
 * and re-sorted on the public distance. Otherwise varying the radius or the
 * centre would let a caller triangulate the exact location of a requester.
 */
export class GetNearbyNeeds {
  constructor(
    private readonly repo: NeedRepository,
    private readonly zoneQueue?: NeedZoneQueue,
  ) {}

  async execute(q: GetNearbyNeedsQuery): Promise<{ items: NearbyNeedView[] }> {
    const results = await this.repo.findNearbyValidated(
      EmergencyId.fromString(q.emergencyId),
      {
        lat: q.lat,
        lng: q.lng,
        radiusMeters: q.radiusMeters + approxRadiusMeters(),
        limit: q.limit,
      },
    );
    scheduleMissingZones(
      this.zoneQueue,
      results.map((r) => r.need),
    );

    const items = results
      .map((r) => {
        const view = toPublicNeedView(r.need);
        const distanceMeters = Math.round(
          haversineMeters(
            q.lat,
            q.lng,
            view.location.latitude,
            view.location.longitude,
          ),
        );
        return { ...view, distanceMeters };
      })
      .filter((v) => v.distanceMeters <= q.radiusMeters)
      .sort(
        (a, b) =>
          a.distanceMeters - b.distanceMeters ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )
      .slice(0, q.limit);
    return { items };
  }
}
