import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { GeocodingModule } from '../src/contexts/geocoding/infrastructure/geocoding.module';
import { GEOCODING_PROVIDER } from '../src/contexts/geocoding/domain/ports/geocoding.provider';
import { MAP_LINK_EXPANDER } from '../src/contexts/geocoding/domain/ports/map-link-expander';
import type { MapShortLink } from '../src/contexts/geocoding/domain/map-short-link';

describe('Geocoding flow (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const reverseCalls: Array<[number, number, string | undefined]> = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GeocodingModule],
    })
      .overrideProvider(GEOCODING_PROVIDER)
      .useValue({
        search: (q: string) =>
          Promise.resolve(
            q.length >= 3
              ? [{ address: `${q}, Spain`, latitude: 40.0, longitude: -3.5 }]
              : [],
          ),
        reverse: (lat: number, lon: number, lang?: string) => {
          reverseCalls.push([lat, lon, lang]);
          return Promise.resolve(
            lat === 0 && lon === 0
              ? null
              : { address: 'Calle Mayor, Sol, Madrid', zone: 'Sol, Madrid' },
          );
        },
      })
      .overrideProvider(MAP_LINK_EXPANDER)
      .useValue({
        expand: (link: MapShortLink) =>
          Promise.resolve(
            link.href.endsWith('/Dead')
              ? null
              : 'https://www.google.com/maps/place/@40.4,-3.7,17z',
          ),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /geocode?q=Madrid returns geocode results', async () => {
    const res = await request(server).get('/geocode?q=Madrid').expect(200);

    const body = res.body as Array<{
      address: string;
      latitude: number;
      longitude: number;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0].address).toBe('string');
    expect(typeof body[0].latitude).toBe('number');
    expect(typeof body[0].longitude).toBe('number');
  });

  it('GET /geocode?q=ab returns empty array', async () => {
    const res = await request(server).get('/geocode?q=ab').expect(200);

    expect(res.body).toEqual([]);
  });

  it('GET /geocode?q= returns empty array for empty query', async () => {
    const res = await request(server).get('/geocode?q=').expect(200);

    expect(res.body).toEqual([]);
  });

  describe('GET /geocode/reverse', () => {
    it('returns the label with the rounded coordinates', async () => {
      const res = await request(server)
        .get('/geocode/reverse?lat=40.41677512&lon=-3.70379099&lang=es')
        .expect(200);
      expect(res.body).toEqual({
        address: 'Calle Mayor, Sol, Madrid',
        latitude: 40.4168,
        longitude: -3.7038,
      });
      expect(reverseCalls.at(-1)).toEqual([40.4168, -3.7038, 'es']);
    });

    it('returns 200 with address null when nothing is found', async () => {
      const res = await request(server)
        .get('/geocode/reverse?lat=0&lon=0')
        .expect(200);
      expect(res.body).toEqual({ address: null, latitude: 0, longitude: 0 });
    });

    it.each([
      '/geocode/reverse?lat=91&lon=0',
      '/geocode/reverse?lat=0&lon=-181',
      '/geocode/reverse?lat=abc&lon=0',
      '/geocode/reverse?lon=0',
    ])('400 on invalid input: %s', async (url) => {
      await request(server).get(url).expect(400);
    });
  });

  describe('GET /geocode/expand-link', () => {
    it('200 with the final URL', async () => {
      const res = await request(server)
        .get('/geocode/expand-link')
        .query({ url: 'https://maps.app.goo.gl/AbC' })
        .expect(200);
      expect(res.body).toEqual({
        url: 'https://www.google.com/maps/place/@40.4,-3.7,17z',
      });
    });

    it.each([
      'https://evil.com/AbC',
      'http://169.254.169.254/',
      'https://maps.app.goo.gl.evil.com/AbC',
      '',
    ])('400 for a non-allowed link %p', async (url) => {
      await request(server)
        .get('/geocode/expand-link')
        .query({ url })
        .expect(400);
    });

    it('400 when url is missing', async () => {
      await request(server).get('/geocode/expand-link').expect(400);
    });

    it('422 when the link cannot be resolved', async () => {
      await request(server)
        .get('/geocode/expand-link')
        .query({ url: 'https://maps.app.goo.gl/Dead' })
        .expect(422);
    });
  });
});
