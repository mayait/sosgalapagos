/**
 * Bounded in-memory cache with per-entry TTL and least-recently-used eviction.
 *
 * Replaces an unbounded `Map` that grew with every distinct query (a memory
 * exhaustion vector on a public, unauthenticated endpoint). `Map` keeps
 * insertion order, so re-inserting on read moves an entry to the "most
 * recent" end and the first key is always the eviction candidate.
 *
 * Per-process by design: in a multi-instance deployment each process keeps its
 * own hot cache; correctness never depends on a hit.
 */
export class LruTtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly defaultTtlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('LruTtlCache maxEntries must be a positive integer');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the cache entry (`{ value }`) or `undefined` on a miss / expired
   * entry. Wrapping the value lets callers cache negative results (`null`).
   */
  get(key: K): { value: V } | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { value: entry.value };
  }

  set(key: K, value: V, ttlMs: number = this.defaultTtlMs): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
