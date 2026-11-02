import {
  bucketAccuracy,
  InvalidLocationCaptureError,
  LocationCapture,
} from './location-capture';

describe('LocationCapture', () => {
  it('returns null when nothing is provided', () => {
    expect(LocationCapture.create(undefined)).toBeNull();
    expect(LocationCapture.create({})).toBeNull();
    expect(LocationCapture.create({ reference: '   ' })).toBeNull();
  });

  it('trims the reference and buckets the accuracy', () => {
    const c = LocationCapture.create({
      reference: '  Portón verde  ',
      method: 'gps',
      accuracyM: 12.5,
    });
    expect(c?.toSnapshot()).toEqual({
      reference: 'Portón verde',
      method: 'gps',
      accuracy: '<50',
    });
  });

  it('rejects a reference longer than 200 characters', () => {
    expect(() =>
      LocationCapture.create({ reference: 'x'.repeat(201) }),
    ).toThrow(InvalidLocationCaptureError);
  });

  it('rejects an unknown method', () => {
    expect(() => LocationCapture.create({ method: 'telepathy' })).toThrow(
      InvalidLocationCaptureError,
    );
  });

  it('knows whether the address came from a geocoder', () => {
    expect(LocationCapture.create({ method: 'map' })?.hasGeocodedAddress).toBe(
      true,
    );
    expect(LocationCapture.create({ method: 'zone' })?.hasGeocodedAddress).toBe(
      false,
    );
  });

  it('rehydrates leniently from persisted values', () => {
    expect(
      LocationCapture.fromSnapshot({
        reference: 'x',
        method: 'bogus' as never,
        accuracy: '50-200',
      })?.toSnapshot(),
    ).toEqual({ reference: 'x', method: null, accuracy: '50-200' });
    expect(
      LocationCapture.fromSnapshot({
        reference: null,
        method: null,
        accuracy: null,
      }),
    ).toBeNull();
  });
});

describe('bucketAccuracy', () => {
  it.each([
    [0, '<50'],
    [49.9, '<50'],
    [50, '50-200'],
    [200, '50-200'],
    [200.1, '>200'],
    [5000, '>200'],
  ])('%p m → %p', (m, bucket) => {
    expect(bucketAccuracy(m)).toBe(bucket);
  });

  it('rejects negative / non-finite values', () => {
    expect(() => bucketAccuracy(-1)).toThrow();
    expect(() => bucketAccuracy(Number.NaN)).toThrow();
  });
});
