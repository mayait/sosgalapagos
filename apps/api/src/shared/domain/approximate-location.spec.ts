import {
  APPROX_GRID_METERS,
  approxRadiusMeters,
  snapToGrid,
} from './approximate-location';
import { haversineMeters } from './geo-distance';

const LAT = 10.4806;
const LNG = -66.9036;

describe('snapToGrid (fixed public grid)', () => {
  it('defaults to a 500 m grid', () => {
    expect(APPROX_GRID_METERS).toBe(500);
  });

  it('is deterministic: the same point always maps to the same public point', () => {
    const a = snapToGrid(LAT, LNG);
    const b = snapToGrid(LAT, LNG);
    expect(a).toEqual(b);
  });

  it('moves the point (never returns the exact coordinates)', () => {
    const p = snapToGrid(LAT, LNG);
    expect(p.lat === LAT && p.lng === LNG).toBe(false);
  });

  it('maps different points of the same cell to the identical public point', () => {
    const center = snapToGrid(LAT, LNG);
    // A few metres around the centre stay inside the same 500 m cell.
    const nearby = [
      [center.lat + 0.0005, center.lng + 0.0005],
      [center.lat - 0.0008, center.lng + 0.001],
      [center.lat + 0.001, center.lng - 0.0015],
    ];
    for (const [lat, lng] of nearby) {
      expect(snapToGrid(lat, lng)).toEqual(center);
    }
  });

  it('keeps the true point within approxRadiusMeters of the public point', () => {
    const radius = approxRadiusMeters();
    for (let i = 0; i < 200; i++) {
      const lat = -60 + ((i * 7.31) % 120);
      const lng = -170 + ((i * 13.77) % 340);
      const p = snapToGrid(lat, lng);
      expect(haversineMeters(lat, lng, p.lat, p.lng)).toBeLessThanOrEqual(
        radius + 1,
      );
    }
  });

  it('separates points that are far apart into different cells', () => {
    const a = snapToGrid(LAT, LNG);
    const b = snapToGrid(LAT + 0.01, LNG); // ~1.1 km north
    expect(a).not.toEqual(b);
  });

  it('honours a custom cell size', () => {
    const p = snapToGrid(LAT, LNG, 2000);
    expect(haversineMeters(LAT, LNG, p.lat, p.lng)).toBeLessThanOrEqual(
      approxRadiusMeters(2000) + 1,
    );
  });

  it('handles edge coordinates without producing invalid values', () => {
    for (const [lat, lng] of [
      [90, 180],
      [-90, -180],
      [0, 179.9999],
      [89.9999, 0],
    ]) {
      const p = snapToGrid(lat, lng);
      expect(p.lat).toBeGreaterThanOrEqual(-90);
      expect(p.lat).toBeLessThanOrEqual(90);
      expect(p.lng).toBeGreaterThanOrEqual(-180);
      expect(p.lng).toBeLessThanOrEqual(180);
    }
  });

  it('rejects a non-positive cell size', () => {
    expect(() => snapToGrid(LAT, LNG, 0)).toThrow();
  });
});

describe('approxRadiusMeters', () => {
  it('is half the cell diagonal, rounded up', () => {
    expect(approxRadiusMeters(500)).toBe(354);
  });
});
