import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ACCESS_CONTROL } from '../../../identity/domain/authorization/access-control';
import type { AccessControl } from '../../../identity/domain/authorization/access-control';
import { SCOPE_RESOLVER } from '../../../identity/infrastructure/http/scope-resolver';
import type { ScopeResolver } from '../../../identity/infrastructure/http/scope-resolver';
import type { AuthenticatedUser } from '../../../identity/infrastructure/http/jwt-auth.guard';
import { clientIp } from '../../../../shared/http/client-ip';

/** Needs a citizen may file per rolling window, per IP and per user. */
export const NEED_CREATION_LIMIT = 10;
/** Rolling window: one hour. */
export const NEED_CREATION_WINDOW_MS = 3_600_000;

/**
 * Anti-flood guard for `POST /emergencies/:emergencyId/needs`.
 *
 * - **Bypass**: service accounts (trusted integrations filing on behalf of
 *   many people; they are already rate-limited per API key by the global
 *   guard) and principals that can validate needs in the emergency's scope
 *   (coordinators/validators/admins — they legitimately file in bulk).
 * - Everyone else: two independent buckets, per IP and per user, each
 *   {@link NEED_CREATION_LIMIT} per hour. Exceeding either → 429.
 *
 * MUST run after the authentication guard (needs `req.user`). Mirrors the
 * validity-report guard; no-op when throttling is disabled (test env).
 */
@Injectable()
export class NeedCreationThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    @InjectThrottlerOptions() private readonly options: ThrottlerModuleOptions,
    @Inject(ACCESS_CONTROL) private readonly access: AccessControl,
    @Inject(SCOPE_RESOLVER) private readonly scopeResolver: ScopeResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = Array.isArray(this.options)
      ? this.options
      : this.options.throttlers;
    if (!rules || rules.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) return true;
    if (user.isServiceAccount) return true;

    const scopeChain = await this.scopeResolver.resolve(req);
    const isValidator = await this.access.can(
      { principalId: user.id, grants: user.grants },
      'need:validate',
      { scopeChain },
    );
    if (isValidator) return true;

    await this.hit(`need-create:ip:${clientIp(req)}`);
    await this.hit(`need-create:user:${user.id}`);
    return true;
  }

  private async hit(key: string): Promise<void> {
    const { isBlocked } = await this.storage.increment(
      key,
      NEED_CREATION_WINDOW_MS,
      NEED_CREATION_LIMIT,
      NEED_CREATION_WINDOW_MS,
      'need-create',
    );
    if (isBlocked) throw new ThrottlerException();
  }
}
