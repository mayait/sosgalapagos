import { MinIntervalGate } from './min-interval-gate';

/** Fake clock whose sleep advances time instantly and records each wait. */
function fakeClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: (ms: number) => {
      sleeps.push(ms);
      t += ms;
      return Promise.resolve();
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

describe('MinIntervalGate', () => {
  it('lets the first call through immediately', async () => {
    const clock = fakeClock();
    const gate = new MinIntervalGate({ now: clock.now, sleep: clock.sleep });

    await expect(gate.acquire()).resolves.toBe(true);
    expect(clock.sleeps).toEqual([]);
  });

  it('spaces consecutive calls at least minIntervalMs apart', async () => {
    const clock = fakeClock();
    const starts: number[] = [];
    const gate = new MinIntervalGate({
      minIntervalMs: 1100,
      now: clock.now,
      sleep: clock.sleep,
    });

    for (let i = 0; i < 3; i++) {
      await gate.acquire();
      starts.push(clock.now());
    }

    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1100);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1100);
  });

  it('does not wait when the interval already elapsed', async () => {
    const clock = fakeClock();
    const gate = new MinIntervalGate({
      minIntervalMs: 1100,
      now: clock.now,
      sleep: clock.sleep,
    });
    await gate.acquire();
    clock.advance(5000);
    await gate.acquire();
    expect(clock.sleeps).toEqual([]);
  });

  it('rejects when the reserved slot would exceed maxWaitMs', async () => {
    // Sleep never resolves → callers stay queued and reservations pile up.
    const t = 0;
    const gate = new MinIntervalGate({
      minIntervalMs: 1100,
      maxQueue: 100,
      maxWaitMs: 3000,
      now: () => t,
      sleep: () => new Promise<void>(() => undefined),
    });
    expect(await gate.acquire()).toBe(true); // slot at 0
    void gate.acquire(); // slot at 1100
    void gate.acquire(); // slot at 2200
    // next slot would be at 3300 > 3000
    await expect(gate.acquire()).resolves.toBe(false);
  });

  it('rejects when maxQueue callers are already waiting', async () => {
    const gate = new MinIntervalGate({
      minIntervalMs: 10,
      maxQueue: 2,
      maxWaitMs: 1_000_000,
      now: () => 0,
      sleep: () => new Promise<void>(() => undefined),
    });
    expect(await gate.acquire()).toBe(true);
    void gate.acquire();
    void gate.acquire();
    expect(gate.pending).toBe(2);
    await expect(gate.acquire()).resolves.toBe(false);
  });

  it('run() returns the fallback without executing the task when rejected', async () => {
    const gate = new MinIntervalGate({
      minIntervalMs: 10_000,
      maxWaitMs: 0,
      now: () => 0,
      sleep: () => Promise.resolve(),
    });
    await gate.acquire(); // consumes the free slot
    const task = jest.fn().mockResolvedValue(['x']);
    await expect(gate.run(task, [])).resolves.toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });
});
