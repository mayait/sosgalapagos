import {
  GeocodeResult,
  GeocodingProvider,
  SearchBias,
} from '../domain/ports/geocoding.provider';
import { parseViewbox, sanitizeLang } from './geocode-params';

export interface SearchAddressQuery {
  query: string;
  /** `west,south,east,north`; dropped silently when invalid. */
  viewbox?: string | undefined;
  /** `xx` / `xx-YY`; dropped silently when invalid. */
  lang?: string | undefined;
}

export class SearchAddress {
  constructor(private readonly provider: GeocodingProvider) {}

  async execute({
    query,
    viewbox,
    lang,
  }: SearchAddressQuery): Promise<GeocodeResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const bias: SearchBias = {};
    const box = parseViewbox(viewbox);
    if (box) bias.viewbox = box;
    const language = sanitizeLang(lang);
    if (language) bias.lang = language;

    return Object.keys(bias).length > 0
      ? this.provider.search(trimmed, bias)
      : this.provider.search(trimmed);
  }
}
