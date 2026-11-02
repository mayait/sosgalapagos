import {
  APPROX_ZONE_FALLBACK_LABEL,
  toPublicNeedView,
  toCoordinatorNeedView,
} from './need-view';
import { Need } from '../domain/need';
import { NeedId } from '../domain/need-id';
import { SupplyLine } from '@globalemergency/warehouse-core/kernel';
import { EmergencyId } from '../../../shared/domain/emergency-id';
import { Priority, Category } from '../domain/need-enums';
import { Location } from '../../../shared/domain/location';
import { LocationSensitivity } from '../../../shared/domain/location-sensitivity';
import {
  LocationCapture,
  LocationCaptureInput,
} from '../../../shared/domain/location-capture';
import { snapToGrid } from '../../../shared/domain/approximate-location';

const EM = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const EXACT_ADDRESS = 'Calle Los Rosales #123, Apt 4B, Chacao, Caracas';
const LAT = 10.4806;
const LNG = -66.9036;
const PRIVATE_REFERENCE = 'Casa de doña Herminia Zambrano, portón verde';

function makeNeed(
  sensitivity: LocationSensitivity,
  opts: {
    address?: string;
    lat?: number;
    lng?: number;
    capture?: LocationCaptureInput;
  } = {},
): Need {
  return Need.create({
    id: NeedId.create(),
    emergencyId: EmergencyId.fromString(EM),
    title: 'Alimentos',
    description: null,
    location: Location.create({
      address: opts.address ?? EXACT_ADDRESS,
      latitude: opts.lat ?? LAT,
      longitude: opts.lng ?? LNG,
    }),
    priority: Priority.High,
    requesterUserId: USER_ID,
    requesterOrganizationId: null,
    locationSensitivity: sensitivity,
    items: [
      SupplyLine.create({
        name: 'Agua',
        quantity: 10,
        unit: 'litros',
        category: Category.Water,
      }),
    ],
    locationCapture: LocationCapture.create(opts.capture),
  });
}

describe('toPublicNeedView — public text of approximate needs', () => {
  it('never publishes (a coarsened version of) free text', () => {
    // Legacy/free-text address: dropping the first segment would still leak
    // "Apt 4B" — so the public view uses a generic label instead.
    const view = toPublicNeedView(makeNeed(LocationSensitivity.Approximate));
    expect(view.location.address).toBe(APPROX_ZONE_FALLBACK_LABEL);
    expect(view.location.address).not.toContain('Rosales');
    expect(view.location.address).not.toContain('Apt 4B');
  });

  it('uses the server-derived zone when available', () => {
    const need = makeNeed(LocationSensitivity.Approximate);
    need.setLocationZone('Chacao, Caracas');
    const view = toPublicNeedView(need);
    expect(view.location.address).toBe('Chacao, Caracas');
    expect(view.location.zone).toBe('Chacao, Caracas');
  });

  it('falls back to the coarsened geocoder label (≥2 segments) when the address came from a geocoder', () => {
    const view = toPublicNeedView(
      makeNeed(LocationSensitivity.Approximate, {
        address: 'Calle Mayor 12, Sol, Madrid, Comunidad de Madrid',
        capture: { method: 'map' },
      }),
    );
    expect(view.location.address).toBe('Sol, Madrid, Comunidad de Madrid');
  });

  it('does not use a geocoder label that would keep a single segment', () => {
    const view = toPublicNeedView(
      makeNeed(LocationSensitivity.Approximate, {
        address: 'Calle Mayor 12, Madrid',
        capture: { method: 'gps' },
      }),
    );
    expect(view.location.address).toBe(APPROX_ZONE_FALLBACK_LABEL);
  });

  it('keeps the exact address for public-sensitivity needs', () => {
    const view = toPublicNeedView(makeNeed(LocationSensitivity.Public));
    expect(view.location.address).toBe(EXACT_ADDRESS);
    expect(view.approxRadiusMeters).toBeNull();
  });
});

describe('toPublicNeedView — fixed-grid public point', () => {
  it('snaps approximate needs to the grid cell centre and exposes the radius', () => {
    const need = makeNeed(LocationSensitivity.Approximate);
    const view = toPublicNeedView(need);
    const cell = snapToGrid(LAT, LNG);
    expect(view.location.latitude).toBe(cell.lat);
    expect(view.location.longitude).toBe(cell.lng);
    expect(view.location.latitude).not.toBe(LAT);
    expect(view.approxRadiusMeters).toBe(354);
  });

  it('3 needs filed from the same spot get the IDENTICAL public point', () => {
    const views = [1, 2, 3].map(() =>
      toPublicNeedView(makeNeed(LocationSensitivity.Approximate)),
    );
    // Different ids (no per-id seed any more)…
    expect(new Set(views.map((v) => v.id)).size).toBe(3);
    // …same public point: averaging them reveals nothing.
    for (const v of views) {
      expect(v.location.latitude).toBe(views[0].location.latitude);
      expect(v.location.longitude).toBe(views[0].location.longitude);
    }
  });

  it('different spots inside the same cell also coincide', () => {
    const center = snapToGrid(LAT, LNG);
    const spots = [
      { lat: center.lat + 0.0004, lng: center.lng - 0.0007 },
      { lat: center.lat - 0.001, lng: center.lng + 0.0012 },
      { lat: center.lat + 0.0015, lng: center.lng + 0.0002 },
    ];
    const views = spots.map((s) =>
      toPublicNeedView(
        makeNeed(LocationSensitivity.Approximate, { lat: s.lat, lng: s.lng }),
      ),
    );
    for (const v of views) {
      expect(v.location.latitude).toBe(center.lat);
      expect(v.location.longitude).toBe(center.lng);
    }
  });

  it('keeps exact coordinates for public-sensitivity needs', () => {
    const view = toPublicNeedView(makeNeed(LocationSensitivity.Public));
    expect(view.location.latitude).toBe(LAT);
    expect(view.location.longitude).toBe(LNG);
  });
});

describe('private location reference', () => {
  it.each([LocationSensitivity.Approximate, LocationSensitivity.Public])(
    'never appears in the public view (%s)',
    (sensitivity) => {
      const need = makeNeed(sensitivity, {
        capture: { reference: PRIVATE_REFERENCE, method: 'gps', accuracyM: 8 },
      });
      const json = JSON.stringify(toPublicNeedView(need));
      expect(json).not.toContain('Herminia');
      expect(json).not.toContain('portón');
      expect(json).not.toContain('locationDetails');
      expect(json).not.toContain('reference');
    },
  );

  it('is visible to coordinators with method and accuracy bucket', () => {
    const view = toCoordinatorNeedView(
      makeNeed(LocationSensitivity.Approximate, {
        capture: {
          reference: PRIVATE_REFERENCE,
          method: 'gps',
          accuracyM: 120,
        },
      }),
    );
    expect(view.locationDetails).toEqual({
      reference: PRIVATE_REFERENCE,
      method: 'gps',
      accuracy: '50-200',
    });
  });
});

describe('toCoordinatorNeedView — exact location', () => {
  it('always returns the exact address and point regardless of sensitivity', () => {
    const view = toCoordinatorNeedView(
      makeNeed(LocationSensitivity.Approximate),
    );
    expect(view.location.address).toBe(EXACT_ADDRESS);
    expect(view.location.latitude).toBe(LAT);
    expect(view.location.longitude).toBe(LNG);
    expect(view.locationDetails).toBeNull();
  });
});
