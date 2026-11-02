import { RegisterResource } from './register-resource';
import { toResourceView, toResourceDetailView } from './resource-view';
import { toResourceAdminDetailView } from './resource-admin-view';
import { InMemoryResourceRepository } from '../infrastructure/in-memory-resource.repository';
import { FakeEventBus } from '../infrastructure/fake-event-bus';
import { ResourceType } from '../domain/resource-enums';
import { ResourceId } from '../domain/resource-id';

const EM = '11111111-1111-4111-8111-111111111111';
const PERSONAL_NAME = 'Rosa Pérez Villacís';

describe('Resource location reference privacy', () => {
  async function registerWithReference() {
    const repo = new InMemoryResourceRepository();
    const useCase = new RegisterResource(repo, new FakeEventBus(), {
      getStatus: () => Promise.resolve('active'),
    });
    const { id } = await useCase.execute({
      emergencyId: EM,
      type: ResourceType.CollectionPoint,
      name: 'Centro de acopio',
      location: {
        address: 'Calle Mayor 1, Madrid',
        latitude: 40.4,
        longitude: -3.7,
        reference: `Preguntar por ${PERSONAL_NAME}`,
        method: 'map',
        accuracyM: 300,
      },
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const resource = await repo.findById(ResourceId.fromString(id));
    if (!resource) throw new Error('not saved');
    return resource;
  }

  it('persists the capture metadata (reference, method, accuracy bucket)', async () => {
    const r = await registerWithReference();
    expect(r.locationCapture?.toSnapshot()).toEqual({
      reference: `Preguntar por ${PERSONAL_NAME}`,
      method: 'map',
      accuracy: '>200',
    });
  });

  it('never exposes it in the public list/detail views', async () => {
    const r = await registerWithReference();
    for (const view of [toResourceView(r), toResourceDetailView(r)]) {
      const json = JSON.stringify(view);
      expect(json).not.toContain('Rosa');
      expect(json).not.toContain('reference');
      expect(json).not.toContain('locationDetails');
    }
  });

  it('shows it on the platform-admin view only', async () => {
    const r = await registerWithReference();
    expect(toResourceAdminDetailView(r, 'Emergencia').locationDetails).toEqual({
      reference: `Preguntar por ${PERSONAL_NAME}`,
      method: 'map',
      accuracy: '>200',
    });
  });
});
