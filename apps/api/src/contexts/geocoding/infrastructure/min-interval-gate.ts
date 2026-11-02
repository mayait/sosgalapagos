/**
 * Global pacing gate for an upstream with a strict request-rate policy.
 *
 * Nominatim's public usage policy allows at most ONE request per second for
 * the whole application (not per end user). Every outbound call — search AND
 * reverse — must therefore go through a single shared gate that spaces them
 * at least `minIntervalMs` apart.
 *
 * Callers reserve the next free slot and sleep until it arrives. To keep the
 * user-facing request bounded, a caller is turned away (`acquire()` resolves
 * `false`) instead of queued when:
 * - `maxQueue` callers are already waiting for a slot, or
 * - its slot would arrive later than `maxWaitMs` from now.
 * The adapter then degrades gracefully (empty result) rather than hammering
 * the upstream or hanging the HTTP request.
 *
 * Clock and sleep are injectable so the behaviour is unit-testable without
 * real timers.
 */
export interface MinIntervalGateOptions {
  minIntervalMs?: number;
  maxQueue?: number;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class MinIntervalGate {
  readonly minIntervalMs: number;
  readonly maxQueue: number;
  readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** Earliest timestamp at which the next call may start. */
  private nextSlotAt = 0;
  /** Callers currently sleeping until their reserved slot. */
  private waiting = 0;

  constructor(options: MinIntervalGateOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1100;
    this.maxQueue = options.maxQueue ?? 8;
    this.maxWaitMs = options.maxWaitMs ?? 6000;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Number of callers currently waiting for their slot. */
  get pending(): number {
    return this.waiting;
  }

  /**
   * Wait for the next free slot. Resolves `true` when the caller may proceed,
   * `false` when it was rejected (queue full or wait too long) — in which case
   * the caller MUST NOT contact the upstream.
   */
  async acquire(): Promise<boolean> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlotAt);
    const wait = slot - now;
    if (wait > 0 && this.waiting >= this.maxQueue) return false;
    if (wait > this.maxWaitMs) return false;

    this.nextSlotAt = slot + this.minIntervalMs;
    if (wait <= 0) return true;

    this.waiting += 1;
    try {
      await this.sleep(wait);
    } finally {
      this.waiting -= 1;
    }
    return true;
  }

  /**
   * Run `task` inside the gate. Returns `onRejected` (without running `task`)
   * when the gate turns the caller away.
   */
  async run<T>(task: () => Promise<T>, onRejected: T): Promise<T> {
    const admitted = await this.acquire();
    if (!admitted) return onRejected;
    return task();
  }
}
