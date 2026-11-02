import { classifyMapLinkTarget, MapShortLink } from '../domain/map-short-link';
import { MapLinkExpander } from '../domain/ports/map-link-expander';

/** Minimal response surface the expander relies on (headers + status only). */
export interface RedirectResponse {
  status: number;
  headers: { get(name: string): string | null };
  body?: { cancel(): Promise<void> } | null;
}

export type RedirectFetchFn = (
  url: string,
  init: RequestInit,
) => Promise<RedirectResponse>;

export interface HttpMapLinkExpanderOptions {
  fetchFn?: RedirectFetchFn;
  /** Per-hop timeout (default 4000 ms). */
  timeoutMs?: number;
  /** Maximum number of requests per expansion (default 3). */
  maxHops?: number;
  userAgent?: string;
}

/**
 * Follows a short link's redirect chain WITHOUT letting the HTTP client follow
 * redirects on its own (`redirect: 'manual'`), so every hop is re-validated:
 *
 * - it only ever connects to hosts accepted by {@link MapShortLink} (the
 *   allowlisted short-link hosts);
 * - a redirect to a Google Maps page ends the expansion and that URL is
 *   returned without being fetched (consent interstitials are unwrapped);
 * - anything else (internal IPs, other hosts, non-redirect responses,
 *   timeouts, more than `maxHops` hops) resolves `null`;
 * - response bodies are never read (they are cancelled immediately).
 */
export class HttpMapLinkExpander implements MapLinkExpander {
  private readonly fetchFn: RedirectFetchFn;
  private readonly timeoutMs: number;
  private readonly maxHops: number;
  private readonly userAgent: string | undefined;

  constructor(options: HttpMapLinkExpanderOptions = {}) {
    this.fetchFn =
      options.fetchFn ??
      ((url, init): Promise<RedirectResponse> => globalThis.fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 4000;
    this.maxHops = options.maxHops ?? 3;
    this.userAgent = options.userAgent;
  }

  async expand(link: MapShortLink): Promise<string | null> {
    let current: MapShortLink = link;
    for (let hop = 0; hop < this.maxHops; hop++) {
      const location = await this.fetchLocation(current);
      if (location === null) return null;

      let next: URL;
      try {
        next = new URL(location, current.href);
      } catch {
        return null;
      }

      const target = classifyMapLinkTarget(next);
      if (target === null) return null;
      if (target.kind === 'final') return target.url;
      current = target.link;
    }
    return null;
  }

  /** One request to an allowlisted host; returns its `Location` or null. */
  private async fetchLocation(link: MapShortLink): Promise<string | null> {
    let response: RedirectResponse;
    try {
      response = await this.fetchFn(link.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: this.userAgent ? { 'User-Agent': this.userAgent } : {},
      });
    } catch {
      return null;
    }
    // Never read the body.
    try {
      await response.body?.cancel();
    } catch {
      // ignore
    }
    if (response.status < 300 || response.status >= 400) return null;
    return response.headers.get('location');
  }
}
