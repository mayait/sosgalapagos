import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import {
  NEED_CREATION_LIMIT,
  NeedCreationThrottlerGuard,
} from './need-creation-throttler.guard';

function contextFor(
  user:
    { id: string; grants: unknown[]; isServiceAccount?: boolean } | undefined,
  ip = '1.2.3.4',
): ExecutionContext {
  const req = { ip, user, headers: {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function buildGuard(opts: {
  options?: unknown;
  canValidate?: boolean;
  blockedKeys?: string[];
}) {
  const hits: Array<{ key: string; limit: number }> = [];
  const storage = {
    increment: (key: string, _ttl: number, limit: number) => {
      hits.push({ key, limit });
      return Promise.resolve({
        isBlocked: (opts.blockedKeys ?? []).includes(key),
      });
    },
  };
  const access = { can: () => Promise.resolve(opts.canValidate ?? false) };
  const scopeResolver = { resolve: () => Promise.resolve([]) };
  const guard = new NeedCreationThrottlerGuard(
    storage as never,
    (opts.options ?? [{ name: 'default', ttl: 1000, limit: 1 }]) as never,
    access as never,
    scopeResolver,
  );
  return { guard, hits };
}

const citizen = { id: 'u1', grants: [], isServiceAccount: false };

describe('NeedCreationThrottlerGuard', () => {
  it('applies per-IP and per-user buckets of 10/hour to citizens', async () => {
    const { guard, hits } = buildGuard({});
    await expect(guard.canActivate(contextFor(citizen))).resolves.toBe(true);
    expect(hits).toEqual([
      { key: 'need-create:ip:1.2.3.4', limit: NEED_CREATION_LIMIT },
      { key: 'need-create:user:u1', limit: NEED_CREATION_LIMIT },
    ]);
    expect(NEED_CREATION_LIMIT).toBe(10);
  });

  it('throws 429 when either bucket overflows', async () => {
    const { guard } = buildGuard({ blockedKeys: ['need-create:user:u1'] });
    await expect(guard.canActivate(contextFor(citizen))).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });

  it('exempts service accounts and validators', async () => {
    const sa = buildGuard({});
    await sa.guard.canActivate(
      contextFor({ id: 'sa', grants: [], isServiceAccount: true }),
    );
    expect(sa.hits).toHaveLength(0);

    const coordinator = buildGuard({ canValidate: true });
    await coordinator.guard.canActivate(contextFor(citizen));
    expect(coordinator.hits).toHaveLength(0);
  });

  it('is a no-op when throttling is disabled (test env)', async () => {
    const { guard, hits } = buildGuard({ options: [] });
    await expect(guard.canActivate(contextFor(citizen))).resolves.toBe(true);
    expect(hits).toHaveLength(0);
  });
});
