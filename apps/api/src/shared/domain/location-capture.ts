/**
 * Shared Kernel — LocationCapture value object.
 *
 * Restricted metadata captured alongside a {@link Location} when a citizen
 * marks a point (need, resource, donation offer):
 *
 * - `reference`: free-text directions to get there ("green gate behind the
 *   school, ask for Rosa"). PRIVATE — it routinely contains names, phone
 *   numbers and house descriptions. It is only ever surfaced to coordinators /
 *   owners and must NEVER appear in an anonymous/public response.
 * - `method`: how the point was set (`gps` fix, picked on the `map`, from a
 *   `search` result, a pasted `link`, or only a `zone` was given), so
 *   coordinators know how much to trust it.
 * - `accuracy`: the GPS accuracy, stored only as a coarse bucket.
 *
 * Kept separate from `Location` on purpose: `Location.toPlain()` is what the
 * public views serialise, so the private reference can never ride along by
 * accident.
 */

export const LOCATION_METHODS = [
  'gps',
  'map',
  'search',
  'link',
  'zone',
] as const;
export type LocationMethod = (typeof LOCATION_METHODS)[number];

export const LOCATION_ACCURACY_BUCKETS = ['<50', '50-200', '>200'] as const;
export type LocationAccuracyBucket = (typeof LOCATION_ACCURACY_BUCKETS)[number];

/** Methods whose `address` comes from a geocoder (not typed free text). */
export const GEOCODED_LOCATION_METHODS: readonly LocationMethod[] = [
  'gps',
  'map',
  'search',
  'link',
];

export const LOCATION_REFERENCE_MAX_LENGTH = 200;

export class InvalidLocationCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLocationCaptureError';
  }
}

export interface LocationCaptureInput {
  reference?: string | null;
  method?: string | null;
  /** Raw accuracy in metres (e.g. `GeolocationCoordinates.accuracy`). */
  accuracyM?: number | null;
}

export interface LocationCaptureSnapshot {
  reference: string | null;
  method: LocationMethod | null;
  accuracy: LocationAccuracyBucket | null;
}

export function isLocationMethod(value: unknown): value is LocationMethod {
  return (
    typeof value === 'string' &&
    (LOCATION_METHODS as readonly string[]).includes(value)
  );
}

function isAccuracyBucket(value: unknown): value is LocationAccuracyBucket {
  return (
    typeof value === 'string' &&
    (LOCATION_ACCURACY_BUCKETS as readonly string[]).includes(value)
  );
}

/** Bucket a raw accuracy in metres: <50, 50-200 or >200. */
export function bucketAccuracy(meters: number): LocationAccuracyBucket {
  if (!Number.isFinite(meters) || meters < 0) {
    throw new InvalidLocationCaptureError(
      'accuracyM must be a non-negative number',
    );
  }
  if (meters < 50) return '<50';
  if (meters <= 200) return '50-200';
  return '>200';
}

export class LocationCapture {
  private constructor(
    readonly reference: string | null,
    readonly method: LocationMethod | null,
    readonly accuracy: LocationAccuracyBucket | null,
  ) {}

  /**
   * Validate raw input. Returns `null` when nothing was provided, so callers
   * can store "no capture metadata" for legacy/API clients.
   */
  static create(input: LocationCaptureInput | null | undefined) {
    if (!input) return null;

    const reference = input.reference?.trim() || null;
    if (
      reference !== null &&
      reference.length > LOCATION_REFERENCE_MAX_LENGTH
    ) {
      throw new InvalidLocationCaptureError(
        `reference must be at most ${LOCATION_REFERENCE_MAX_LENGTH} characters`,
      );
    }

    let method: LocationMethod | null = null;
    if (input.method !== undefined && input.method !== null) {
      if (!isLocationMethod(input.method)) {
        throw new InvalidLocationCaptureError(
          `method must be one of ${LOCATION_METHODS.join(', ')}`,
        );
      }
      method = input.method;
    }

    const accuracy =
      input.accuracyM === undefined || input.accuracyM === null
        ? null
        : bucketAccuracy(input.accuracyM);

    if (reference === null && method === null && accuracy === null) {
      return null;
    }
    return new LocationCapture(reference, method, accuracy);
  }

  /** Rehydrate from persisted columns (lenient: unknown values → null). */
  static fromSnapshot(
    s: Partial<LocationCaptureSnapshot> | null | undefined,
  ): LocationCapture | null {
    if (!s) return null;
    const reference = s.reference ?? null;
    const method = isLocationMethod(s.method) ? s.method : null;
    const accuracy = isAccuracyBucket(s.accuracy) ? s.accuracy : null;
    if (reference === null && method === null && accuracy === null) {
      return null;
    }
    return new LocationCapture(reference, method, accuracy);
  }

  /** True when the address was produced by a geocoder, not typed by hand. */
  get hasGeocodedAddress(): boolean {
    return (
      this.method !== null && GEOCODED_LOCATION_METHODS.includes(this.method)
    );
  }

  toSnapshot(): LocationCaptureSnapshot {
    return {
      reference: this.reference,
      method: this.method,
      accuracy: this.accuracy,
    };
  }
}
