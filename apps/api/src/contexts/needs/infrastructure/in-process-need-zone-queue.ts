import { Logger } from '@nestjs/common';
import { NeedZoneQueue } from '../domain/ports/need-zone';

export interface InProcessNeedZoneQueueOptions {
  /** Upper bound on queued ids; extra ids are dropped (retried next read). */
  maxPending?: number;
  /** Do not retry the same id within this window (default 10 min). */
  retryAfterMs?: number;
  now?: () => number;
}

/**
 * Best-effort, in-process, SEQUENTIAL runner for zone resolution.
 *
 * - `enqueue` returns immediately (never blocks or throws).
 * - Ids are de-duplicated and processed one at a time, so background work
 *   never occupies more than one slot of the shared geocoding gate and
 *   interactive lookups keep priority.
 * - An id attempted recently is skipped for `retryAfterMs` (failures are
 *   retried later, when the need is read again).
 *
 * Losing the queue on restart is harmless: the next public read of a need
 * still missing its zone schedules it again.
 */
export class InProcessNeedZoneQueue implements NeedZoneQueue {
  private readonly logger = new Logger(InProcessNeedZoneQueue.name);
  private readonly pending = new Set<string>();
  private readonly attemptedAt = new Map<string, number>();
  private readonly maxPending: number;
  private readonly retryAfterMs: number;
  private readonly now: () => number;
  private running: Promise<void> | null = null;

  constructor(
    private readonly resolve: (needId: string) => Promise<unknown>,
    options: InProcessNeedZoneQueueOptions = {},
  ) {
    this.maxPending = options.maxPending ?? 200;
    this.retryAfterMs = options.retryAfterMs ?? 10 * 60_000;
    this.now = options.now ?? Date.now;
  }

  enqueue(needId: string): void {
    if (this.pending.has(needId)) return;
    const last = this.attemptedAt.get(needId);
    if (last !== undefined && this.now() - last < this.retryAfterMs) return;
    if (this.pending.size >= this.maxPending) return;
    this.pending.add(needId);
    this.kick();
  }

  private kick(): void {
    if (this.running !== null) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      // An id may have arrived between the last loop check and now.
      if (this.pending.size > 0) this.kick();
    });
  }

  /** Resolves when the queue is empty (for tests / graceful shutdown). */
  async idle(): Promise<void> {
    while (this.running !== null) await this.running;
  }

  private async drain(): Promise<void> {
    // Yield first so enqueue() never runs work synchronously.
    await Promise.resolve();
    for (;;) {
      const next = this.pending.values().next();
      if (next.done === true) return;
      const needId = next.value;
      this.pending.delete(needId);
      this.remember(needId);
      try {
        await this.resolve(needId);
      } catch (error) {
        this.logger.warn(
          `Zone resolution failed for need ${needId}: ${String(error)}`,
        );
      }
    }
  }

  private remember(needId: string): void {
    this.attemptedAt.delete(needId);
    this.attemptedAt.set(needId, this.now());
    // Bound memory: drop the oldest attempts.
    while (this.attemptedAt.size > this.maxPending * 10) {
      const oldest = this.attemptedAt.keys().next();
      if (oldest.done === true) break;
      this.attemptedAt.delete(oldest.value);
    }
  }
}

/** Disabled queue (tests / deployments without geocoding). */
export class NoopNeedZoneQueue implements NeedZoneQueue {
  enqueue(): void {
    // intentionally empty
  }
}
