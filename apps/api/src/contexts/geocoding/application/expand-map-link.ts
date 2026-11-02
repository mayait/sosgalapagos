import { MapShortLink } from '../domain/map-short-link';
import { MapLinkExpander } from '../domain/ports/map-link-expander';

/** The input is not an allowed map short link (→ 400). */
export class InvalidMapShortLinkError extends Error {
  constructor() {
    super('Not an allowed map short link');
    this.name = 'InvalidMapShortLinkError';
  }
}

/** The short link could not be resolved to a map URL (→ 422). */
export class UnresolvableMapLinkError extends Error {
  constructor() {
    super('The short link could not be resolved');
    this.name = 'UnresolvableMapLinkError';
  }
}

/**
 * Expand a map short link (e.g. `https://maps.app.goo.gl/…`) so the client can
 * read the coordinates from the final URL. Browsers cannot follow these
 * redirects themselves (CORS), hence the server-side hop.
 */
export class ExpandMapLink {
  constructor(private readonly expander: MapLinkExpander) {}

  async execute(rawUrl: string): Promise<{ url: string }> {
    const link = MapShortLink.parse(rawUrl);
    if (link === null) throw new InvalidMapShortLinkError();

    let expanded: string | null;
    try {
      expanded = await this.expander.expand(link);
    } catch {
      expanded = null;
    }
    if (expanded === null) throw new UnresolvableMapLinkError();
    return { url: expanded };
  }
}
