/**
 * Lectura y validación de los campos ocultos del selector de ubicación, común
 * a las tres acciones del servidor (petición, registrar punto, ofrecer donación).
 *
 * Campos: `address` (etiqueta pública de la zona), `latitude`, `longitude`,
 * `reference` (privada), `method` y `accuracyM`.
 */
import { isValidPoint } from './coordinates.ts';
import { LOCATION_METHODS, REFERENCE_MAX_LENGTH, type LocationMethod } from './location-picker-state.ts';

export interface LocationPayload {
  address: string;
  latitude: number;
  longitude: number;
  reference?: string;
  method?: LocationMethod;
  accuracyM?: number;
}

export type LocationFieldsResult =
  | { ok: true; location: LocationPayload }
  | { ok: false; error: 'required' | 'invalid' };

/** Lo mínimo de `FormData` que se usa (facilita los tests). */
export interface FormDataLike {
  get(name: string): unknown;
}

const ADDRESS_MAX_LENGTH = 200;
const ACCURACY_MAX_M = 100_000;

function text(form: FormDataLike, name: string): string {
  const v = form.get(name);
  // Quita caracteres de control y espacios repetidos.
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export function parseLocationFields(
  form: FormDataLike,
  { defaultAddress }: { defaultAddress: string },
): LocationFieldsResult {
  const latStr = text(form, 'latitude');
  const lonStr = text(form, 'longitude');
  if (latStr === '' || lonStr === '') return { ok: false, error: 'required' };

  const latitude = Number(latStr);
  const longitude = Number(lonStr);
  if (!isValidPoint(latitude, longitude)) return { ok: false, error: 'invalid' };

  const address = text(form, 'address').slice(0, ADDRESS_MAX_LENGTH);
  const reference = text(form, 'reference').slice(0, REFERENCE_MAX_LENGTH);
  const rawMethod = text(form, 'method');
  const method = (LOCATION_METHODS as readonly string[]).includes(rawMethod)
    ? (rawMethod as LocationMethod)
    : undefined;
  const accStr = text(form, 'accuracyM');
  const acc = accStr === '' ? NaN : Number(accStr);
  const accuracyM =
    method === 'gps' && Number.isFinite(acc) && acc > 0 && acc <= ACCURACY_MAX_M
      ? Math.round(acc)
      : undefined;

  return {
    ok: true,
    location: {
      address: address !== '' ? address : defaultAddress,
      latitude,
      longitude,
      ...(reference !== '' ? { reference } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(accuracyM !== undefined ? { accuracyM } : {}),
    },
  };
}
