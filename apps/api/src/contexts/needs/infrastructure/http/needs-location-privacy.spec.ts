/**
 * HTTP-level privacy guarantees for need locations, without a database:
 * the real controller, DTO validation and use cases over the in-memory repo.
 *
 * - A private `location.reference` (containing a personal name) is accepted on
 *   creation, visible to coordinators, and NEVER present in any anonymous GET.
 * - Approximate needs from the same place share one public point.
 */
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { NeedsController } from './needs.controller';
import { CreateNeed } from '../../application/create-need';
import { ValidateNeed } from '../../application/validate-need';
import { EditNeed } from '../../application/edit-need';
import { DiscardNeed } from '../../application/discard-need';
import { GetPublicNeeds } from '../../application/get-public-needs';
import { GetNearbyNeeds } from '../../application/get-nearby-needs';
import { GetNeedsInBounds } from '../../application/get-needs-in-bounds';
import { GetNeedsQueue } from '../../application/get-needs-queue';
import { AssignNeedManager } from '../../application/assign-need-manager';
import { RenewNeed, GetExpiredNeeds } from '../../application/renew-need';
import { SuggestVolunteersForNeed } from '../../application/suggest-volunteers-for-need';
import { CreateTaskFromNeed } from '../../application/create-task-from-need';
import { InMemoryNeedRepository } from '../in-memory-need.repository';
import { FakeEventBus } from '../fake-event-bus';
import { JwtOrApiKeyAuthGuard } from '../../../identity/infrastructure/http/jwt-or-api-key-auth.guard';
import { ServiceAccountPermissionGuard } from '../../../identity/infrastructure/http/service-account-permission.guard';
import { JwtAuthGuard } from '../../../identity/infrastructure/http/jwt-auth.guard';
import { PermissionGuard } from '../../../identity/infrastructure/http/permission.guard';
import { NeedCreationThrottlerGuard } from './need-creation-throttler.guard';
import { NeedsDomainExceptionFilter } from './domain-exception.filter';
import { NeedZoneQueue } from '../../domain/ports/need-zone';

const EM = '44444444-4444-4444-8444-444444444444';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERSONAL_NAME = 'Rosa Pérez Villacís';

class FakeUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    req.user = {
      id: USER_ID,
      email: 'citizen@example.org',
      isAdmin: false,
      isServiceAccount: false,
      grants: [],
    };
    return true;
  }
}

const allow: CanActivate = { canActivate: () => true };

function needBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Agua para la familia',
    priority: 'high',
    location: {
      address: 'Calle Mayor 12, Sol, Madrid, Comunidad de Madrid',
      latitude: 40.41678,
      longitude: -3.70379,
      reference: `Casa de ${PERSONAL_NAME}, portón verde`,
      method: 'gps',
      accuracyM: 14,
    },
    items: [{ name: 'Agua', quantity: 10, unit: 'l', category: 'water' }],
    ...overrides,
  };
}

describe('Needs HTTP — location privacy (no DB)', () => {
  let app: INestApplication;
  let server: Server;
  const repo = new InMemoryNeedRepository();
  const bus = new FakeEventBus();
  const enqueued: string[] = [];
  const zoneQueue: NeedZoneQueue = { enqueue: (id) => enqueued.push(id) };

  beforeAll(async () => {
    const statusReader = { getStatus: () => Promise.resolve('active') };
    const moduleRef = await Test.createTestingModule({
      controllers: [NeedsController],
      providers: [
        {
          provide: CreateNeed,
          useValue: new CreateNeed(
            repo,
            bus,
            statusReader,
            undefined,
            zoneQueue,
          ),
        },
        { provide: ValidateNeed, useValue: new ValidateNeed(repo, bus) },
        { provide: EditNeed, useValue: {} },
        { provide: DiscardNeed, useValue: {} },
        {
          provide: GetPublicNeeds,
          useValue: new GetPublicNeeds(repo, zoneQueue),
        },
        {
          provide: GetNearbyNeeds,
          useValue: new GetNearbyNeeds(repo, zoneQueue),
        },
        {
          provide: GetNeedsInBounds,
          useValue: new GetNeedsInBounds(repo, zoneQueue),
        },
        { provide: GetNeedsQueue, useValue: new GetNeedsQueue(repo) },
        { provide: AssignNeedManager, useValue: {} },
        { provide: RenewNeed, useValue: {} },
        { provide: GetExpiredNeeds, useValue: {} },
        { provide: SuggestVolunteersForNeed, useValue: {} },
        { provide: CreateTaskFromNeed, useValue: {} },
      ],
    })
      .overrideGuard(JwtOrApiKeyAuthGuard)
      .useValue(new FakeUserGuard())
      .overrideGuard(JwtAuthGuard)
      .useValue(new FakeUserGuard())
      .overrideGuard(ServiceAccountPermissionGuard)
      .useValue(allow)
      .overrideGuard(PermissionGuard)
      .useValue(allow)
      .overrideGuard(NeedCreationThrottlerGuard)
      .useValue(allow)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new NeedsDomainExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAndValidate(body = needBody()): Promise<string> {
    const res = await request(server)
      .post(`/emergencies/${EM}/needs`)
      .send(body)
      .expect(201);
    const id = (res.body as { id: string }).id;
    await request(server).post(`/needs/${id}/validate`).expect(204);
    return id;
  }

  it('accepts reference/method/accuracyM and shows them only to coordinators', async () => {
    const res = await request(server)
      .post(`/emergencies/${EM}/needs`)
      .send(needBody())
      .expect(201);
    const id = (res.body as { id: string }).id;
    expect(enqueued).toContain(id); // zone resolution scheduled, not awaited

    const queue = await request(server)
      .get(`/emergencies/${EM}/needs/queue`)
      .expect(200);
    const mine = (
      queue.body as Array<{
        id: string;
        locationDetails: unknown;
        location: { address: string };
      }>
    ).find((n) => n.id === id);
    expect(mine?.locationDetails).toEqual({
      reference: `Casa de ${PERSONAL_NAME}, portón verde`,
      method: 'gps',
      accuracy: '<50',
    });
    expect(mine?.location.address).toContain('Calle Mayor 12');
  });

  it('rejects an invalid method and a too-long reference (400)', async () => {
    const bad = needBody();
    await request(server)
      .post(`/emergencies/${EM}/needs`)
      .send({ ...bad, location: { ...bad.location, method: 'telepathy' } })
      .expect(400);
    await request(server)
      .post(`/emergencies/${EM}/needs`)
      .send({
        ...bad,
        location: { ...bad.location, reference: 'x'.repeat(201) },
      })
      .expect(400);
  });

  it('never returns the reference (or the personal name) in anonymous GETs', async () => {
    await createAndValidate();

    const responses = [
      await request(server).get(`/emergencies/${EM}/public/needs`).expect(200),
      await request(server)
        .get(`/emergencies/${EM}/public/needs/in-bounds`)
        .query({ minLat: 40, minLng: -4, maxLat: 41, maxLng: -3 })
        .expect(200),
      await request(server)
        .get(`/emergencies/${EM}/public/needs/nearby`)
        .query({ lat: 40.4168, lng: -3.7038, radius: 5000 })
        .expect(200),
    ];

    for (const res of responses) {
      const json = JSON.stringify(res.body);
      expect(json).toContain('Agua para la familia'); // the need IS listed
      expect(json).not.toContain('Rosa');
      expect(json).not.toContain(PERSONAL_NAME);
      expect(json).not.toContain('portón');
      expect(json).not.toContain('reference');
      expect(json).not.toContain('locationDetails');
      // nor the exact street line / exact coordinates
      expect(json).not.toContain('Calle Mayor 12');
      expect(json).not.toContain('40.41678');
    }
  });

  it('3 needs from the same house share one public point in the public list', async () => {
    const ids = [
      await createAndValidate(),
      await createAndValidate(),
      await createAndValidate(),
    ];
    const res = await request(server)
      .get(`/emergencies/${EM}/public/needs`)
      .expect(200);
    const points = (
      res.body as Array<{
        id: string;
        location: { latitude: number; longitude: number };
        approxRadiusMeters: number | null;
      }>
    )
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ ...n.location, r: n.approxRadiusMeters }));
    expect(points).toHaveLength(3);
    expect(
      new Set(points.map((p) => `${p.latitude},${p.longitude}`)).size,
    ).toBe(1);
    expect(points[0].r).toBe(354);
  });
});
