/**
 * Estado del selector de ubicación (reducer puro).
 *
 * Reglas:
 * - Un resultado de geocodificación inversa solo se aplica si su clave coincide
 *   con la petición pendiente (las respuestas viejas se descartan).
 * - La geocodificación inversa nunca toca la referencia que escribió la
 *   persona: va a la etiqueta pública de la zona (`zoneLabel`).
 * - Editar la referencia NUNCA borra el punto.
 * - Solo la búsqueda, el GPS y un enlace recentran el mapa; mover el mapa no.
 */
import { isValidPoint, roundCoord, type GeoPoint } from './coordinates.ts';

export const LOCATION_METHODS = ['gps', 'map', 'search', 'link', 'zone'] as const;
export type LocationMethod = (typeof LOCATION_METHODS)[number];

export const REFERENCE_MAX_LENGTH = 200;

export interface LocationPickerState {
  point: GeoPoint | null;
  method: LocationMethod | null;
  /** Precisión del GPS en metros (solo con method 'gps'). */
  accuracyM: number | null;
  /** Etiqueta pública de la zona («Barrio Las Ninfas, Puerto Ayora»). */
  zoneLabel: string | null;
  /** Clave de `point` a la que corresponde `zoneLabel`. */
  zoneKey: string | null;
  /** Clave de la geocodificación inversa que se espera. */
  pendingReverseKey: string | null;
  /** Referencia privada para llegar, escrita por la persona. */
  reference: string;
  /** Sugerencia de referencia (p. ej. el nombre del lugar buscado). */
  suggestion: string | null;
  /** Aumenta cada vez que el mapa debe centrarse en `point`. */
  recenterSeq: number;
}

export type LocationPickerAction =
  | {
      type: 'set-point';
      point: GeoPoint;
      method: LocationMethod;
      accuracyM?: number | null;
      /** Nombre del lugar elegido en la búsqueda, como sugerencia de referencia. */
      suggestion?: string | null;
    }
  | { type: 'reverse-result'; key: string; label: string | null }
  | { type: 'reverse-failed'; key: string }
  | { type: 'set-reference'; value: string }
  | { type: 'use-suggestion' }
  | { type: 'restore'; snapshot: LocationDraft }
  | { type: 'reset' };

export const INITIAL_PICKER_STATE: LocationPickerState = {
  point: null,
  method: null,
  accuracyM: null,
  zoneLabel: null,
  zoneKey: null,
  pendingReverseKey: null,
  reference: '',
  suggestion: null,
  recenterSeq: 0,
};

/** Clave de caché de la geocodificación inversa: el punto a 4 decimales (~11 m). */
export function reverseKey(point: GeoPoint): string {
  return `${roundCoord(point.latitude).toFixed(4)},${roundCoord(point.longitude).toFixed(4)}`;
}

/** Los métodos que mueven el mapa hasta el punto. */
function recenters(method: LocationMethod): boolean {
  return method === 'search' || method === 'gps' || method === 'link';
}

function capReference(value: string): string {
  return value.slice(0, REFERENCE_MAX_LENGTH);
}

export function locationPickerReducer(
  state: LocationPickerState,
  action: LocationPickerAction,
): LocationPickerState {
  switch (action.type) {
    case 'set-point': {
      if (!isValidPoint(action.point.latitude, action.point.longitude)) return state;
      const key = reverseKey(action.point);
      const sameZone = key === state.zoneKey;
      return {
        ...state,
        point: { latitude: action.point.latitude, longitude: action.point.longitude },
        method: action.method,
        accuracyM: action.method === 'gps' ? (action.accuracyM ?? null) : null,
        zoneLabel: sameZone ? state.zoneLabel : null,
        zoneKey: sameZone ? state.zoneKey : null,
        pendingReverseKey: sameZone ? null : key,
        suggestion:
          action.suggestion !== undefined
            ? action.suggestion
            : action.method === 'map'
              ? state.suggestion
              : null,
        recenterSeq: recenters(action.method) ? state.recenterSeq + 1 : state.recenterSeq,
      };
    }
    case 'reverse-result': {
      if (action.key !== state.pendingReverseKey) return state;
      const label = action.label !== null && action.label.trim() !== '' ? action.label.trim() : null;
      return { ...state, zoneLabel: label, zoneKey: action.key, pendingReverseKey: null };
    }
    case 'reverse-failed': {
      if (action.key !== state.pendingReverseKey) return state;
      return { ...state, pendingReverseKey: null };
    }
    case 'set-reference':
      // Solo cambia la referencia: el punto, el método y la zona se conservan.
      return { ...state, reference: capReference(action.value) };
    case 'use-suggestion':
      if (state.suggestion === null) return state;
      return { ...state, reference: capReference(state.suggestion), suggestion: null };
    case 'restore': {
      const s = action.snapshot;
      const point =
        s.latitude !== null && s.longitude !== null && isValidPoint(s.latitude, s.longitude)
          ? { latitude: s.latitude, longitude: s.longitude }
          : null;
      if (point === null && s.reference === '') return state;
      const key = point !== null ? reverseKey(point) : null;
      const hasZone = point !== null && s.zoneLabel !== null;
      return {
        ...state,
        point,
        method: point !== null ? s.method : null,
        accuracyM: point !== null && s.method === 'gps' ? s.accuracyM : null,
        zoneLabel: hasZone ? s.zoneLabel : null,
        zoneKey: hasZone ? key : null,
        pendingReverseKey: point !== null && !hasZone ? key : null,
        reference: capReference(s.reference),
        suggestion: null,
        recenterSeq: point !== null ? state.recenterSeq + 1 : state.recenterSeq,
      };
    }
    case 'reset':
      return { ...INITIAL_PICKER_STATE, recenterSeq: state.recenterSeq };
  }
}

// ── Borrador (localStorage) ──────────────────────────────────────────────────

/** Lo que se guarda del selector en el borrador del formulario. */
export interface LocationDraft {
  latitude: number | null;
  longitude: number | null;
  method: LocationMethod | null;
  accuracyM: number | null;
  zoneLabel: string | null;
  reference: string;
  /** Marca de tiempo (ms) de cuando se guardó. */
  savedAt: number;
}

export const LOCATION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function toDraft(state: LocationPickerState, now: number): LocationDraft {
  return {
    latitude: state.point?.latitude ?? null,
    longitude: state.point?.longitude ?? null,
    method: state.method,
    accuracyM: state.accuracyM,
    zoneLabel: state.zoneLabel,
    reference: state.reference,
    savedAt: now,
  };
}

function isMethod(v: unknown): v is LocationMethod {
  return typeof v === 'string' && (LOCATION_METHODS as readonly string[]).includes(v);
}

/** Lee un borrador guardado; `null` si está mal formado o caducó (24 h). */
export function parseDraft(raw: string | null, now: number): LocationDraft | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const savedAt = typeof d.savedAt === 'number' ? d.savedAt : NaN;
  if (!Number.isFinite(savedAt) || now - savedAt > LOCATION_DRAFT_TTL_MS || savedAt > now + 60_000) {
    return null;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    latitude: num(d.latitude),
    longitude: num(d.longitude),
    method: isMethod(d.method) ? d.method : null,
    accuracyM: num(d.accuracyM),
    zoneLabel: typeof d.zoneLabel === 'string' ? d.zoneLabel : null,
    reference: typeof d.reference === 'string' ? capReference(d.reference) : '',
    savedAt,
  };
}
