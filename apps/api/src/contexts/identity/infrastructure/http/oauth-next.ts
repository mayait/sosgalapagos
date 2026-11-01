/**
 * Helpers for carrying the post-login "return path" (`next`) across the OAuth
 * round-trip.
 *
 * A protected page sends the browser to `/login?next=/grupos`; if the user then
 * chooses Google/Facebook, the flow bounces API → provider → API before landing
 * back on the web app. The path can't ride on the OAuth `state` (reserved for
 * CSRF) nor on a cookie shared with the web app (API and web live on different
 * domains), so we stash it in a short-lived httpOnly cookie on the API side when
 * the flow starts and read it back in the callback to build the final redirect.
 */

/** Cookie that carries the sanitized return path between initiate and callback. */
export const OAUTH_NEXT_COOKIE = 'rh_oauth_next';

/**
 * Returns `value` only when it is a safe internal relative path; otherwise
 * `undefined`. Guards against open-redirect attacks: absolute URLs
 * (`https://evil.com`), protocol-relative (`//evil.com`) and backslash tricks
 * (`/\evil.com`, which browsers fold into `//evil.com`).
 */
export function sanitizeNextPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/')) return undefined;
  if (value.startsWith('//')) return undefined;
  if (value.includes('\\')) return undefined;
  return value;
}

/**
 * Path for the OAuth cookies as the BROWSER sees it. Behind a reverse proxy
 * that mounts the API under a prefix (e.g. `https://site.org/backend`, with
 * the prefix stripped before reaching Nest), a cookie scoped to `/auth` would
 * never be sent back to `/backend/auth/.../callback`. The prefix is taken from
 * the pathname of `OAUTH_CALLBACK_BASE`, which already includes it.
 */
export function oauthCookiePath(
  callbackBase: string | undefined = process.env.OAUTH_CALLBACK_BASE,
): string {
  let prefix = '';
  try {
    if (callbackBase)
      prefix = new URL(callbackBase).pathname.replace(/\/+$/, '');
  } catch {
    prefix = '';
  }
  return `${prefix}/auth`;
}
