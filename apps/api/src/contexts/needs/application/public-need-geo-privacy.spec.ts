/**
 * Spatial queries must not leak the exact location of approximate needs:
 * membership, distance and ordering are all computed on the PUBLIC point.
 */
import { GetNeedsInBounds } from './get-needs-in-bounds';
import { GetNearbyNeeds } from './get-nearby-needs';
import { InMemoryNeedRepository } from '../infrastructure/in-memory-need.repository';
import { Need } from '../domain/need';
import { NeedId } from '../domain/need-id';
import { EmergencyId } from '../../../shared/domain/emergency-id';
import { Location } from '../../../shared/domain/location';
import { LocationSensitivity } from '../../../shared/domain/location-sensitivity';
import { Priority, Category } from '../domain/need-enums';
import { SupplyLine } from '@globalemergency/warehouse-core/kernel';
import { snapToGrid } from '../../../shared/domain/approximate-location';
import { haversineMeters } from '../../../shared/domain/geo-distance';

const EM = '11111111-1111-4111-8111-111111111111';
const EXACT = { lat: 40.41678, lng: -3.70379 };

async function seedValidated(
  repo: InMemoryNeedRepository,
  lat: number,
  lng: number,
): Promise<Need> {
  const need = Need.create({
    id: NeedId.create(),
    emergencyId: EmergencyId.fromString(EM),
    title: 'x',
    description: null,
    location: Location.create({
      address: 'Somewhere',
      latitude: lat,
      longitude: lng,
    }),
    priority: Priority.High,
    requesterUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    requesterOrganizationId: null,
    locationSensitivity: LocationSensitivity.Approximate,
    items: [
      SupplyLine.create({
        name: 'Agua',
        quantity: 1,
        unit: null,
        category: Category.Water,
      }),
    ],
  });
  need.validate();
  await repo.save(need);
  return need;
}

describe('GetNeedsInBounds — no exact-location probing', () => {
  it('a tiny box around the EXACT point returns nothing (unless it holds the public point)', async () => {
    const repo = new InMemoryNeedRepository();
    await seedValidated(repo, EXACT.lat, EXACT.lng);
    const useCase = new GetNeedsInBounds(repo);
    const cell = snapToGrid(EXACT.lat, EXACT.lng);

    const tiny = await useCase.execute({
      emergencyId: EM,
      minLat: EXACT.lat - 0.00001,
      minLng: EXACT.lng - 0.00001,
      maxLat: EXACT.lat + 0.00001,
      maxLng: EXACT.lng + 0.00001,
      limit: 10,
    });
    const containsCentre =
      Math.abs(cell.lat - EXACT.lat) <= 0.00001 &&
      Math.abs(cell.lng - EXACT.lng) <= 0.00001;
    expect(tiny.items).toHaveLength(containsCentre ? 1 : 0);
  });

  it('returns the need when the box holds its public point, even if the exact point is outside', async () => {
    const repo = new InMemoryNeedRepository();
    await seedValidated(repo, EXACT.lat, EXACT.lng);
    const cell = snapToGrid(EXACT.lat, EXACT.lng);

    const res = await new GetNeedsInBounds(repo).execute({
      emergencyId: EM,
      minLat: cell.lat - 0.00001,
      minLng: cell.lng - 0.00001,
      maxLat: cell.lat + 0.00001,
      maxLng: cell.lng + 0.00001,
      limit: 10,
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].location.latitude).toBe(cell.lat);
  });
});

describe('GetNearbyNeeds — distance from the public point only', () => {
  it('reports the distance to the public point and filters on it', async () => {
    const repo = new InMemoryNeedRepository();
    await seedValidated(repo, EXACT.lat, EXACT.lng);
    const cell = snapToGrid(EXACT.lat, EXACT.lng);
    const publicDistance = haversineMeters(
      EXACT.lat,
      EXACT.lng,
      cell.lat,
      cell.lng,
    );
    const useCase = new GetNearbyNeeds(repo);

    // Centred on the EXACT point with a radius smaller than the public
    // displacement: the need must not be revealed as "within X m".
    const near = await useCase.execute({
      emergencyId: EM,
      lat: EXACT.lat,
      lng: EXACT.lng,
      radiusMeters: Math.floor(publicDistance) - 1,
      limit: 10,
    });
    expect(near.items).toHaveLength(0);

    const wider = await useCase.execute({
      emergencyId: EM,
      lat: EXACT.lat,
      lng: EXACT.lng,
      radiusMeters: 1000,
      limit: 10,
    });
    expect(wider.items).toHaveLength(1);
    expect(wider.items[0].distanceMeters).toBe(Math.round(publicDistance));
  });

  it('includes a need whose public point is inside the radius even if the exact one is not', async () => {
    const repo = new InMemoryNeedRepository();
    await seedValidated(repo, EXACT.lat, EXACT.lng);
    const cell = snapToGrid(EXACT.lat, EXACT.lng);

    const res = await new GetNearbyNeeds(repo).execute({
      emergencyId: EM,
      lat: cell.lat,
      lng: cell.lng,
      radiusMeters: 1,
      limit: 10,
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].distanceMeters).toBe(0);
  });
});
