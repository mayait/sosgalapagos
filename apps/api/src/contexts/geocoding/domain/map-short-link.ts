/**
 * MapShortLink — a validated map short link the server is allowed to CONNECT
 * to in order to learn where it redirects.
 *
 * Expanding user-supplied URLs server-side is a classic SSRF vector, so the
 * rules are deliberately strict and allowlist-based:
 * - `https:` only, default port (443) only, no credentials;
 * - no IP literals (v4 or v6), host lowercased with any trailing dot removed;
 * - host must be exactly `maps.app.goo.gl`, or `goo.gl` with a `/maps/` path.
 *
 * The server only ever connects to hosts accepted by this value object. A
 * redirect to a Google Maps page ({@link isGoogleMapsHost}) is the END of the
 * expansion: that URL is returned to the caller WITHOUT being fetched.
 */
export class MapShortLink {
  private constructor(
    readonly host: string,
    readonly href: string,
  ) {}

  /** Parse an untrusted string; `null` when it is not an allowed short link. */
  static parse(raw: string): MapShortLink | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 2048) return null;
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    return MapShortLink.fromUrl(url);
  }

  /** Validate an already-parsed URL (e.g. a redirect `Location`). */
  static fromUrl(url: URL): MapShortLink | null {
    if (url.protocol !== 'https:') return null;
    if (url.username !== '' || url.password !== '') return null;
    // `URL` normalises an explicit :443 to '' for https; anything else is a
    // non-default port and is rejected.
    if (url.port !== '') return null;

    const host = normalizeHost(url.hostname);
    if (host === null || isIpLiteral(host)) return null;

    const path = url.pathname;
    const allowed =
      (host === 'maps.app.goo.gl' && path.length > 1) ||
      (host === 'goo.gl' && path.startsWith('/maps/') && path.length > 6);
    if (!allowed) return null;

    // Rebuild from validated parts only (drops credentials/fragment, uses
    // the normalised host).
    return new MapShortLink(host, `https://${host}${path}${url.search}`);
  }
}

/** Lowercase + strip one trailing dot; `null` for an empty host. */
export function normalizeHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host.length > 0 ? host : null;
}

/** True for IPv4 dotted quads and anything that looks like IPv6. */
export function isIpLiteral(host: string): boolean {
  if (host.includes(':') || host.startsWith('[')) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

const GOOGLE_MAPS_HOST =
  /^(www\.|maps\.)?google\.(com|[a-z]{2}|com?\.[a-z]{2})$/;

/** `google.com`, `www.google.es`, `maps.google.co.uk`, `google.com.ec`… */
export function isGoogleMapsHost(host: string): boolean {
  return GOOGLE_MAPS_HOST.test(host);
}

/**
 * Classification of a redirect target during expansion:
 * - `short`: another allowed short link → may be fetched (next hop);
 * - `final`: a Google Maps page → returned as-is, never fetched.
 * `null` means "not acceptable" (stop, unresolvable).
 *
 * A `consent.google.com/...?continue=<url>` interstitial is unwrapped: its
 * `continue` URL is validated as a final Google Maps URL and returned —
 * consent.google.com itself is never fetched.
 */
export type MapLinkTarget =
  { kind: 'short'; link: MapShortLink } | { kind: 'final'; url: string };

export function classifyMapLinkTarget(url: URL): MapLinkTarget | null {
  const short = MapShortLink.fromUrl(url);
  if (short) return { kind: 'short', link: short };

  const final = asFinalGoogleMapsUrl(url);
  if (final) return { kind: 'final', url: final };

  if (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    normalizeHost(url.hostname) === 'consent.google.com'
  ) {
    const next = url.searchParams.get('continue');
    if (next === null) return null;
    let continueUrl: URL;
    try {
      continueUrl = new URL(next);
    } catch {
      return null;
    }
    const unwrapped = asFinalGoogleMapsUrl(continueUrl);
    return unwrapped ? { kind: 'final', url: unwrapped } : null;
  }
  return null;
}

function asFinalGoogleMapsUrl(url: URL): string | null {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '') return null;
  const host = normalizeHost(url.hostname);
  if (host === null || !isGoogleMapsHost(host)) return null;
  const copy = new URL(url.toString());
  copy.hostname = host;
  return copy.toString();
}
