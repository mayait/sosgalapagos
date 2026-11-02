import { MapShortLink } from '../map-short-link';

export const MAP_LINK_EXPANDER = Symbol('MapLinkExpander');

/**
 * Resolves a validated short link to the final map URL it redirects to.
 * Resolves `null` when it cannot be resolved safely (timeout, too many hops,
 * redirect to a non-allowlisted host, no redirect at all…).
 */
export interface MapLinkExpander {
  expand(link: MapShortLink): Promise<string | null>;
}
