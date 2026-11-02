import { InProcessNeedZoneQueue } from './in-process-need-zone-queue';

describe('InProcessNeedZoneQueue', () => {
  it('returns immediately and processes ids sequentially, de-duplicated', async () => {
    let active = 0;
    let maxActive = 0;
    const seen: string[] = [];
    const queue = new InProcessNeedZoneQueue(async (id) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      seen.push(id);
      await new Promise((r) => setTimeout(r, 1));
      active -= 1;
    });

    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('a'); // duplicate while pending
    expect(seen).toEqual([]); // nothing ran synchronously
    await queue.idle();

    expect(seen).toEqual(['a', 'b']);
    expect(maxActive).toBe(1);
  });

  it('does not retry the same id within the cooldown', async () => {
    let t = 0;
    const calls: string[] = [];
    const queue = new InProcessNeedZoneQueue(
      (id) => {
        calls.push(id);
        return Promise.resolve();
      },
      { retryAfterMs: 1000, now: () => t },
    );

    queue.enqueue('a');
    await queue.idle();
    queue.enqueue('a');
    await queue.idle();
    t = 1500;
    queue.enqueue('a');
    await queue.idle();

    expect(calls).toEqual(['a', 'a']);
  });

  it('swallows failures and keeps going', async () => {
    const calls: string[] = [];
    const queue = new InProcessNeedZoneQueue((id) => {
      calls.push(id);
      return id === 'bad'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve();
    });
    queue.enqueue('bad');
    queue.enqueue('good');
    await queue.idle();
    expect(calls).toEqual(['bad', 'good']);
  });

  it('drops ids beyond maxPending', async () => {
    const calls: string[] = [];
    const queue = new InProcessNeedZoneQueue(
      (id) => {
        calls.push(id);
        return Promise.resolve();
      },
      { maxPending: 2 },
    );
    queue.enqueue('1');
    queue.enqueue('2');
    queue.enqueue('3');
    await queue.idle();
    expect(calls).toEqual(['1', '2']);
  });
});
