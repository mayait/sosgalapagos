import { NeedRepository } from '../domain/ports/need.repository';
import { NeedZoneQueue, NeedZoneResolver } from '../domain/ports/need-zone';
import { NeedId } from '../domain/need-id';
import { Need } from '../domain/need';
import { LocationSensitivity } from '../../../shared/domain/location-sensitivity';
import { publicPointOf } from './need-view';

/** True when the need's public text still lacks a server-derived zone. */
export function needsZone(n: Need): boolean {
  return (
    n.locationSensitivity === LocationSensitivity.Approximate &&
    n.locationZone === null
  );
}

/** Schedule zone resolution for every approximate need still without one. */
export function scheduleMissingZones(
  queue: NeedZoneQueue | undefined,
  needs: Iterable<Need>,
): void {
  if (!queue) return;
  for (const n of needs) {
    if (needsZone(n)) queue.enqueue(n.id.value);
  }
}

/**
 * Resolve and persist the public zone of an approximate need.
 *
 * The zone is computed from the SNAPPED public point (grid cell centre), so:
 * - the exact coordinates are never sent to the third-party geocoder;
 * - every need of the same cell shares one (cached) lookup and one label.
 */
export class ResolveNeedZone {
  constructor(
    private readonly repo: NeedRepository,
    private readonly resolver: NeedZoneResolver,
  ) {}

  async execute(needId: string): Promise<string | null> {
    const need = await this.repo.findById(NeedId.fromString(needId));
    if (need === null) return null;
    if (!needsZone(need)) return need.locationZone;

    const point = publicPointOf(need);
    const zone = (
      await this.resolver.resolveZone(point.latitude, point.longitude)
    )?.trim();
    if (!zone) return null;

    await this.repo.updateLocationZone(need.id, zone);
    return zone;
  }
}
