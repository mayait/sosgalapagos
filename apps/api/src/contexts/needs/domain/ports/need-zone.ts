export const NEED_ZONE_RESOLVER = Symbol('NeedZoneResolver');
export const NEED_ZONE_QUEUE = Symbol('NeedZoneQueue');

/**
 * Resolves the public, area-level label (neighbourhood / locality) of a
 * point. Called with the already-snapped PUBLIC point of a need, never with
 * the exact coordinates. Resolves `null` when unknown/unavailable.
 */
export interface NeedZoneResolver {
  resolveZone(latitude: number, longitude: number): Promise<string | null>;
}

/**
 * Fire-and-forget scheduling of zone resolution for a need. Keeps the
 * (rate-limited, third-party) reverse geocoding out of the request hot path:
 * implementations must return immediately and never throw.
 */
export interface NeedZoneQueue {
  enqueue(needId: string): void;
}
