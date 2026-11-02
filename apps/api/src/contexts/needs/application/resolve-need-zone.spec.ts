import { ResolveNeedZone, scheduleMissingZones } from './resolve-need-zone';
import { InMemoryNeedRepository } from '../infrastructure/in-memory-need.repository';
import { Need } from '../domain/need';
import { NeedId } from '../domain/need-id';
import { EmergencyId } from '../../../shared/domain/emergency-id';
import { Location } from '../../../shared/domain/location';
import { LocationSensitivity } from '../../../shared/domain/location-sensitivity';
import { Priority, Category } from '../domain/need-enums';
import { SupplyLine } from '@globalemergency/warehouse-core/kernel';
import { snapToGrid } from '../../../shared/domain/approximate-location';
import { NeedZoneResolver } from '../domain/ports/need-zone';

const LAT = 40.41678;
const LNG = -3.70379;

function makeNeed(sensitivity: LocationSensitivity): Need {
  return Need.create({
    id: NeedId.create(),
    emergencyId: EmergencyId.fromString('11111111-1111-4111-8111-111111111111'),
    title: 'x',
    description: null,
    location: Location.create({
      address: 'Somewhere',
      latitude: LAT,
      longitude: LNG,
    }),
    priority: Priority.High,
    requesterUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    requesterOrganizationId: null,
    locationSensitivity: sensitivity,
    items: [
      SupplyLine.create({
        name: 'Agua',
        quantity: 1,
        unit: null,
        category: Category.Water,
      }),
    ],
  });
}

class FakeResolver implements NeedZoneResolver {
  readonly calls: Array<[number, number]> = [];
  constructor(private readonly zone: string | null = 'Sol, Madrid') {}
  resolveZone(lat: number, lng: number) {
    this.calls.push([lat, lng]);
    return Promise.resolve(this.zone);
  }
}

describe('ResolveNeedZone', () => {
  it('resolves from the SNAPPED public point (never the exact one) and persists', async () => {
    const repo = new InMemoryNeedRepository();
    const need = makeNeed(LocationSensitivity.Approximate);
    await repo.save(need);
    const resolver = new FakeResolver();

    const zone = await new ResolveNeedZone(repo, resolver).execute(
      need.id.value,
    );

    const cell = snapToGrid(LAT, LNG);
    expect(resolver.calls).toEqual([[cell.lat, cell.lng]]);
    expect(zone).toBe('Sol, Madrid');
    expect((await repo.findById(need.id))?.locationZone).toBe('Sol, Madrid');
  });

  it('does nothing for public-sensitivity needs or already-resolved zones', async () => {
    const repo = new InMemoryNeedRepository();
    const pub = makeNeed(LocationSensitivity.Public);
    const done = makeNeed(LocationSensitivity.Approximate);
    done.setLocationZone('Ya resuelta');
    await repo.save(pub);
    await repo.save(done);
    const resolver = new FakeResolver();
    const useCase = new ResolveNeedZone(repo, resolver);

    await useCase.execute(pub.id.value);
    expect(await useCase.execute(done.id.value)).toBe('Ya resuelta');
    expect(resolver.calls).toHaveLength(0);
  });

  it('keeps the zone empty when the geocoder finds nothing', async () => {
    const repo = new InMemoryNeedRepository();
    const need = makeNeed(LocationSensitivity.Approximate);
    await repo.save(need);

    await new ResolveNeedZone(repo, new FakeResolver(null)).execute(
      need.id.value,
    );

    expect((await repo.findById(need.id))?.locationZone).toBeNull();
  });
});

describe('scheduleMissingZones', () => {
  it('enqueues only approximate needs without a zone', () => {
    const missing = makeNeed(LocationSensitivity.Approximate);
    const resolved = makeNeed(LocationSensitivity.Approximate);
    resolved.setLocationZone('Z');
    const pub = makeNeed(LocationSensitivity.Public);
    const enqueued: string[] = [];

    scheduleMissingZones({ enqueue: (id) => enqueued.push(id) }, [
      missing,
      resolved,
      pub,
    ]);

    expect(enqueued).toEqual([missing.id.value]);
  });

  it('is a no-op without a queue', () => {
    expect(() =>
      scheduleMissingZones(undefined, [
        makeNeed(LocationSensitivity.Approximate),
      ]),
    ).not.toThrow();
  });
});
