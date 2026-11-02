import { Need } from '../domain/need';

/**
 * Location as exposed in a NeedView. For location-sensitive (approximate)
 * needs the public address is ONLY the server-derived zone label (never the
 * submitted text); coordinators always receive the exact address.
 */
export interface NeedLocationView {
  address: string | null;
  latitude: number;
  longitude: number;
  /**
   * Server-derived area label (neighbourhood / locality) of the public point
   * of an approximate need. Null when not resolved yet or not applicable.
   */
  zone: string | null;
}
import { SupplyLineSnapshot } from '@globalemergency/warehouse-core/kernel';
import { LocationSensitivity } from '../../../shared/domain/location-sensitivity';
import {
  APPROX_GRID_METERS,
  approxRadiusMeters,
  snapToGrid,
} from '../../../shared/domain/approximate-location';
import { coarsenAddress } from '../../../shared/domain/coarsen-address';
import { LocationCaptureSnapshot } from '../../../shared/domain/location-capture';
import { PersonnelSkill } from '../domain/need-enums';
import { AuthorSnapshot } from '../../../shared/domain/author';

export interface NeedView {
  id: string;
  emergencyId: string;
  title: string;
  description: string | null;
  location: NeedLocationView;
  locationSensitivity: LocationSensitivity;
  priority: string;
  requesterOrganizationId: string | null;
  managingOrganizationId: string | null;
  items: SupplyLineSnapshot[];
  status: string;
  createdAt: string;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  /** F05: personnel-need fields — skillSpecialty omitted from public view */
  requiredSkill: PersonnelSkill | null;
  requestedCount: number | null;
  /** Optional link to the resource / final recipient (#60). */
  resourceId: string | null;
  /**
   * For approximate needs: radius (m) around the public point within which
   * the real location lies — draw an area, not a pin. Null when exact.
   */
  approxRadiusMeters: number | null;
}

/**
 * F05: Coordinator view includes the sensitive skillSpecialty field and the
 * restricted `author` contact (#235) — both omitted from the public view.
 */
export interface CoordinatorNeedView extends NeedView {
  skillSpecialty: string | null;
  author: AuthorSnapshot | null;
  /** Restricted: private reference, capture method and accuracy bucket. */
  locationDetails: LocationCaptureSnapshot | null;
}

/** Public label used when no safe zone label is available. */
export const APPROX_ZONE_FALLBACK_LABEL = 'Zona aproximada';

/**
 * Public text for the location of an approximate need. Built ONLY from data
 * that cannot contain what the requester typed:
 * 1. the server-derived zone (reverse geocode of the snapped public point);
 * 2. else, when the address itself came from a geocoder (`method` gps / map /
 *    search / link), that label without its first segment, if ≥2 segments
 *    remain;
 * 3. else a generic label. Free text is never coarsened into public text: a
 *    legacy address like "Behind the stadium, Rosa's house, green gate" would
 *    still leak after dropping its first segment.
 */
export function publicZoneLabel(n: Need): string {
  if (n.locationZone) return n.locationZone;
  if (n.locationCapture?.hasGeocodedAddress) {
    const coarse = coarsenAddress(n.location.address);
    if (coarse !== null && coarse.split(',').length >= 2) return coarse;
  }
  return APPROX_ZONE_FALLBACK_LABEL;
}

/** Public coordinates of a need: snapped to the fixed grid when approximate. */
export function publicPointOf(
  n: Need,
  gridMeters: number = APPROX_GRID_METERS,
): { latitude: number; longitude: number } {
  const exact = n.location;
  if (n.locationSensitivity !== LocationSensitivity.Approximate) {
    return { latitude: exact.latitude, longitude: exact.longitude };
  }
  const snapped = snapToGrid(exact.latitude, exact.longitude, gridMeters);
  return { latitude: snapped.lat, longitude: snapped.lng };
}

/**
 * Map a Need to a public NeedView.
 *
 * When locationSensitivity is 'approximate':
 * - coordinates are snapped to the centre of a fixed ~`gridMeters` grid cell,
 *   so every request from the same place gets the SAME public point (nothing
 *   to average out) — see {@link snapToGrid};
 * - the address is only the server-derived zone ({@link publicZoneLabel});
 * - `approxRadiusMeters` tells the map to draw an area, not a pin.
 *
 * The private `reference` and capture metadata are never part of this view.
 * The domain aggregate always stores exact coordinates internally.
 */
export function toPublicNeedView(
  n: Need,
  gridMeters: number = APPROX_GRID_METERS,
): NeedView {
  const exactLocation = n.location.toPlain();
  const approximate = n.locationSensitivity === LocationSensitivity.Approximate;

  let publicLocation: NeedLocationView;
  if (approximate) {
    const point = publicPointOf(n, gridMeters);
    publicLocation = {
      address: publicZoneLabel(n),
      latitude: point.latitude,
      longitude: point.longitude,
      zone: n.locationZone,
    };
  } else {
    // Built field by field (never spread) so nothing private can ride along.
    publicLocation = {
      address: exactLocation.address,
      latitude: exactLocation.latitude,
      longitude: exactLocation.longitude,
      zone: null,
    };
  }

  return {
    id: n.id.value,
    emergencyId: n.emergencyId.value,
    title: n.title,
    description: n.description,
    location: publicLocation,
    locationSensitivity: n.locationSensitivity,
    priority: n.priority,
    requesterOrganizationId: n.requesterOrganizationId,
    managingOrganizationId: n.managingOrganizationId,
    items: n.items.map((i) => i.toSnapshot()),
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
    lastVerifiedAt: n.lastVerifiedAt ? n.lastVerifiedAt.toISOString() : null,
    // skillSpecialty deliberately excluded from public view (sensitive)
    requiredSkill: n.requiredSkill,
    requestedCount: n.requestedCount,
    resourceId: n.resourceId,
    approxRadiusMeters: approximate ? approxRadiusMeters(gridMeters) : null,
  };
}

/**
 * Map a Need to a coordinator NeedView.
 *
 * Coordinators always receive exact coordinates regardless of sensitivity
 * level — they need the real address to dispatch volunteers.
 */
export function toCoordinatorNeedView(n: Need): CoordinatorNeedView {
  return {
    id: n.id.value,
    emergencyId: n.emergencyId.value,
    title: n.title,
    description: n.description,
    location: { ...n.location.toPlain(), zone: n.locationZone },
    locationSensitivity: n.locationSensitivity,
    priority: n.priority,
    requesterOrganizationId: n.requesterOrganizationId,
    managingOrganizationId: n.managingOrganizationId,
    items: n.items.map((i) => i.toSnapshot()),
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
    lastVerifiedAt: n.lastVerifiedAt ? n.lastVerifiedAt.toISOString() : null,
    requiredSkill: n.requiredSkill,
    skillSpecialty: n.skillSpecialty,
    requestedCount: n.requestedCount,
    resourceId: n.resourceId,
    // Coordinators see the exact point, so no public area radius applies.
    approxRadiusMeters: null,
    author: n.author ? n.author.toSnapshot() : null,
    locationDetails: n.locationCapture ? n.locationCapture.toSnapshot() : null,
  };
}

/**
 * @deprecated Use toPublicNeedView or toCoordinatorNeedView instead.
 * Kept for backwards compatibility with use cases that have not yet been
 * updated to differentiate between public and coordinator views.
 * Defaults to coordinator view (exact coordinates).
 */
export function toNeedView(n: Need): CoordinatorNeedView {
  return toCoordinatorNeedView(n);
}
