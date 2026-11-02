import { LruTtlCache } from './lru-ttl-cache';

describe('LruTtlCache', () => {
  it('returns stored values wrapped (so null can be cached)', () => {
    const cache = new LruTtlCache<string, string | null>(10, 1000);
    cache.set('a', null);
    expect(cache.get('a')).toEqual({ value: null });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after their TTL', () => {
    let t = 0;
    const cache = new LruTtlCache<string, number>(10, 1000, () => t);
    cache.set('a', 1);
    t = 999;
    expect(cache.get('a')).toEqual({ value: 1 });
    t = 1000;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('supports a per-entry TTL override', () => {
    let t = 0;
    const cache = new LruTtlCache<string, number>(10, 1000, () => t);
    cache.set('long', 1, 10_000);
    t = 5000;
    expect(cache.get('long')).toEqual({ value: 1 });
  });

  it('never exceeds maxEntries and evicts the least recently used', () => {
    const cache = new LruTtlCache<string, number>(2, 1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a is now most recent
    cache.set('c', 3); // evicts b
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toEqual({ value: 1 });
    expect(cache.get('c')).toEqual({ value: 3 });
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new LruTtlCache(0, 1000)).toThrow();
  });
});
