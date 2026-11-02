/**
 * Reconoce una ubicación pegada por la persona: un enlace de Google Maps,
 * OpenStreetMap o Apple Maps, una URI `geo:`, o coordenadas escritas a mano
 * (decimales o grados-minutos-segundos).
 *
 * Es puro y no hace red: un enlace corto (`maps.app.goo.gl`) se devuelve como
 * `short-link` para que quien llama lo expanda en el servidor.
 */
import { isValidPoint } from './coordinates.ts';

export type LocationSource = 'google' | 'geo' | 'osm' | 'apple' | 'coordinates';

export type ParsedLocation =
  | { kind: 'point'; latitude: number; longitude: number; source: LocationSource }
  | { kind: 'short-link'; url: string }
  | { kind: 'invalid'; reason: 'empty' | 'unrecognized' | 'out-of-range' };

type Pair = { latitude: number; longitude: number };

const INVALID_UNRECOGNIZED: ParsedLocation = { kind: 'invalid', reason: 'unrecognized' };
const INVALID_RANGE: ParsedLocation = { kind: 'invalid', reason: 'out-of-range' };

// ── Normalización ────────────────────────────────────────────────────────────

/** Signos menos tipográficos (−, –, ‐, ‑, ﹣, －) que llegan al copiar de PDFs o webs. */
function normalizeMinus(s: string): string {
  return s.replace(/[−‒–‐‑﹣－]/g, '-');
}

// ── Coordenadas decimales ────────────────────────────────────────────────────

const NUM = String.raw`[+-]?\d+(?:\.\d+)?`;
const NUM_COMMA = String.raw`[+-]?\d+(?:,\d+)?`;
/** «lat, lng», «lat lng», «lat; lng» con punto decimal. */
const DOT_PAIR = new RegExp(String.raw`^(${NUM})\s*(?:[,;]|\s)\s*(${NUM})$`);
/** «-0,74; -90,31» o «-0,74 -90,31»: coma decimal solo si el separador no es coma. */
const COMMA_PAIR = new RegExp(String.raw`^(${NUM_COMMA})\s*(?:;|\s)\s*(${NUM_COMMA})$`);

function stripWrapping(s: string): string {
  let out = s.trim();
  // Paréntesis o corchetes envolventes: «(-0.74, -90.31)».
  while (/^[([{].*[)\]}]$/.test(out)) out = out.slice(1, -1).trim();
  return out;
}

/** Interpreta «lat,lng» decimal. `null` si el texto no tiene esa forma. */
function parseDecimalPair(raw: string): Pair | null {
  const s = stripWrapping(normalizeMinus(raw));
  const comma = COMMA_PAIR.exec(s);
  if (comma && (comma[1]!.includes(',') || comma[2]!.includes(','))) {
    return {
      latitude: Number(comma[1]!.replace(',', '.')),
      longitude: Number(comma[2]!.replace(',', '.')),
    };
  }
  const dot = DOT_PAIR.exec(s);
  if (dot) return { latitude: Number(dot[1]), longitude: Number(dot[2]) };
  return null;
}

// ── Grados, minutos y segundos / hemisferios ─────────────────────────────────

const HEMI = '[NSEWO]';
const DMS_BODY = String.raw`(\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'\s*)?(?:(\d+(?:\.\d+)?)\s*"\s*)?`;
const DMS_PREFIX = new RegExp(String.raw`(${HEMI})\s*` + DMS_BODY, 'g');
const DMS_SUFFIX = new RegExp(String.raw`(-?)` + DMS_BODY + String.raw`(${HEMI})?`, 'g');

interface DmsPart {
  value: number;
  hemi: string | null;
}

function dmsValue(deg: string, min: string | undefined, sec: string | undefined): number | null {
  const d = Number(deg);
  const m = min !== undefined ? Number(min) : 0;
  const s = sec !== undefined ? Number(sec) : 0;
  if (m >= 60 || s >= 60) return null;
  // Con minutos o segundos, los grados tienen que ser enteros.
  if ((min !== undefined || sec !== undefined) && !Number.isInteger(d)) return null;
  return d + m / 60 + s / 3600;
}

function parseDms(raw: string): Pair | null {
  const s = normalizeMinus(raw)
    .toUpperCase()
    .replace(/[º˚]/g, '°')
    .replace(/''|[″”“]/g, '"')
    .replace(/[′’‘´`]/g, "'")
    .trim();
  // Solo entra aquí si hay símbolos de grados o letras de hemisferio.
  if (!/[°'"]|[NSEWO]/.test(s)) return null;

  const prefixMode = new RegExp(String.raw`^${HEMI}`).test(s);
  const re = prefixMode ? DMS_PREFIX : DMS_SUFFIX;
  re.lastIndex = 0;

  const parts: DmsPart[] = [];
  let consumed = '';
  for (const m of s.matchAll(re)) {
    if (m[0].trim() === '') continue;
    let value: number | null;
    let hemi: string | null;
    if (prefixMode) {
      hemi = m[1]!;
      value = dmsValue(m[2]!, m[3], m[4]);
    } else {
      if (m[2] === undefined) continue;
      value = dmsValue(m[2], m[3], m[4]);
      if (value !== null && m[1] === '-') value = -value;
      hemi = m[5] ?? null;
    }
    if (value === null) return null;
    parts.push({ value, hemi });
    consumed += m[0];
  }
  if (parts.length !== 2) return null;
  // Todo lo que no se reconoció tiene que ser separador (evita «calle 5 y 6»).
  const leftover = s.replace(/[\s,;/]/g, '').length - consumed.replace(/[\s,;/]/g, '').length;
  if (leftover !== 0) return null;

  const signed = (p: DmsPart) => {
    if (p.hemi === 'S' || p.hemi === 'W' || p.hemi === 'O') return -Math.abs(p.value);
    return p.value;
  };
  const isLat = (h: string | null) => h === 'N' || h === 'S';
  const isLng = (h: string | null) => h === 'E' || h === 'W' || h === 'O';
  const [a, b] = parts as [DmsPart, DmsPart];

  if (a.hemi !== null || b.hemi !== null) {
    if (a.hemi === null || b.hemi === null) return null;
    if (isLat(a.hemi) && isLng(b.hemi)) return { latitude: signed(a), longitude: signed(b) };
    if (isLng(a.hemi) && isLat(b.hemi)) return { latitude: signed(b), longitude: signed(a) };
    return null;
  }
  return { latitude: signed(a), longitude: signed(b) };
}

// ── Enlaces ──────────────────────────────────────────────────────────────────

const SCHEMELESS_MAP_URL =
  /(?:^|[\s(])((?:www\.)?(?:google\.[a-z.]{2,8}\/maps|maps\.google\.[a-z.]{2,8}|maps\.app\.goo\.gl|goo\.gl\/maps|openstreetmap\.org|osm\.org|maps\.apple\.com)[^\s<>"']*)/i;

function trimUrlTail(url: string): string {
  let out = url.replace(/[.,;:!?'"»]+$/, '');
  // Un «)» final sin su «(» suele ser puntuación del texto que lo rodea.
  while (out.endsWith(')') && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * Primer enlace dentro de un texto compartido («Mira dónde estoy:
 * https://maps.app.goo.gl/…»). Reconoce `http(s)://`, `geo:` y hosts de
 * mapas conocidos escritos sin esquema.
 */
export function extractFirstUrl(text: string): string | null {
  const withScheme = /(https?:\/\/[^\s<>"']+|geo:[^\s<>"']+)/i.exec(text);
  if (withScheme) return trimUrlTail(withScheme[1]!);
  const bare = SCHEMELESS_MAP_URL.exec(text);
  if (bare) return `https://${trimUrlTail(bare[1]!)}`;
  return null;
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isGoogleMapsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  // google.com, google.com.ec, google.co.uk… (y subdominios como www. o maps.)
  if (!/(^|\.)google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host)) return false;
  return host.startsWith('maps.') || url.pathname.startsWith('/maps');
}

function isShortLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  return host === 'goo.gl' && url.pathname.startsWith('/maps');
}

/** Valor de un parámetro que puede ser «lat,lng», «loc:lat,lng» o «lat+lng». */
function pairFromParam(value: string | null): Pair | null {
  if (value === null) return null;
  const cleaned = value.replace(/^loc:\s*/i, '').replace(/\s*\(.*\)\s*$/, '');
  return parseDecimalPair(cleaned);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // mal codificado: se usa tal cual
  }
}

function pairFromGoogle(url: URL): Pair | null {
  const full = safeDecode(url.pathname) + url.search;
  // 1) `!3d<lat>!4d<lng>`: el lugar exacto. Si hay varios, vale el último.
  const data = [...full.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  const last = data.at(-1);
  if (last) return { latitude: Number(last[1]), longitude: Number(last[2]) };

  // 2) Parámetros que apuntan a un lugar.
  for (const key of ['q', 'query', 'll', 'destination', 'daddr']) {
    const p = pairFromParam(url.searchParams.get(key));
    if (p) return p;
  }

  // 3) Ruta /maps/search|dir|place/<lat,lng>: en «dir» vale el destino (el último).
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'maps' && ['search', 'dir', 'place'].includes(segments[1] ?? '')) {
    let found: Pair | null = null;
    for (const seg of segments.slice(2)) {
      if (seg.startsWith('@') || seg.startsWith('data=')) continue;
      const p = parseDecimalPair(safeDecode(seg).replace(/\+/g, ' '));
      if (p) found = p;
    }
    if (found) return found;
  }

  // 4) Centro del mapa (menos preciso que un lugar).
  for (const key of ['center', 'sll']) {
    const p = pairFromParam(url.searchParams.get(key));
    if (p) return p;
  }
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$|\/)/.exec(url.pathname);
  if (at) return { latitude: Number(at[1]), longitude: Number(at[2]) };
  return null;
}

function pairFromOsm(url: URL): Pair | null {
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat !== null && mlon !== null) {
    const p = parseDecimalPair(`${mlat},${mlon}`);
    if (p) return p;
  }
  const hash = /map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(url.hash);
  if (hash) return { latitude: Number(hash[1]), longitude: Number(hash[2]) };
  return null;
}

function pairFromApple(url: URL): Pair | null {
  for (const key of ['ll', 'coordinate', 'sll', 'q']) {
    const p = pairFromParam(url.searchParams.get(key));
    if (p) return p;
  }
  return null;
}

function pairFromGeoUri(uri: string): Pair | null {
  const body = uri.replace(/^geo:/i, '');
  const [head = '', query = ''] = body.split('?');
  const coords = head.split(';')[0] ?? '';
  const [lat, lng] = coords.split(',');
  const main = lat !== undefined && lng !== undefined ? parseDecimalPair(`${lat},${lng}`) : null;
  // geo:0,0?q=lat,lng(Etiqueta) — Android pone el lugar real en q.
  const q = new URLSearchParams(query).get('q');
  const fromQ = pairFromParam(q);
  if (main && !(main.latitude === 0 && main.longitude === 0)) return main;
  return fromQ ?? main;
}

function point(pair: Pair, source: LocationSource): ParsedLocation {
  if (!isValidPoint(pair.latitude, pair.longitude)) return INVALID_RANGE;
  return { kind: 'point', latitude: pair.latitude, longitude: pair.longitude, source };
}

function parseUrl(raw: string): ParsedLocation {
  if (/^geo:/i.test(raw)) {
    const p = pairFromGeoUri(raw);
    return p ? point(p, 'geo') : INVALID_UNRECOGNIZED;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return INVALID_UNRECOGNIZED;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return INVALID_UNRECOGNIZED;
  const host = url.hostname.toLowerCase();

  if (isShortLink(url)) return { kind: 'short-link', url: url.toString() };
  if (isGoogleMapsUrl(url)) {
    const p = pairFromGoogle(url);
    return p ? point(p, 'google') : INVALID_UNRECOGNIZED;
  }
  if (hostIs(host, 'openstreetmap.org') || hostIs(host, 'osm.org')) {
    const p = pairFromOsm(url);
    return p ? point(p, 'osm') : INVALID_UNRECOGNIZED;
  }
  if (host === 'maps.apple.com' || host === 'maps.apple') {
    const p = pairFromApple(url);
    return p ? point(p, 'apple') : INVALID_UNRECOGNIZED;
  }
  // Cualquier otro host (aunque lleve ?q=lat,lng) no se acepta.
  return INVALID_UNRECOGNIZED;
}

/** Punto de entrada: interpreta lo que la persona pegó o escribió. */
export function parseLocationInput(input: string): ParsedLocation {
  const text = input.trim();
  if (text === '') return { kind: 'invalid', reason: 'empty' };

  const url = extractFirstUrl(text);
  if (url !== null) return parseUrl(url);

  const pair = parseDecimalPair(text) ?? parseDms(text);
  if (pair) return point(pair, 'coordinates');
  return INVALID_UNRECOGNIZED;
}
