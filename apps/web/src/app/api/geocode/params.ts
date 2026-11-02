/** Validación de parámetros comunes a los proxies de geocodificación. */

/** «oeste,sur,este,norte» con números en rango; `null` si no es válido. */
export function parseViewboxParam(raw: string | null): string | null {
  if (raw === null) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts as [number, number, number, number];
  if (Math.abs(w) > 180 || Math.abs(e) > 180 || Math.abs(s) > 90 || Math.abs(n) > 90) return null;
  if (s >= n || w === e) return null;
  return parts.map((v) => Number(v.toFixed(4))).join(',');
}

/** Código de idioma corto («es», «en», «pt-BR»); `null` si no es válido. */
export function parseLangParam(raw: string | null): string | null {
  if (raw === null) return null;
  return /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(raw) ? raw : null;
}
