import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { isValidPoint, roundCoord } from '@/lib/geo/coordinates';
import { parseLangParam } from '../params';

/**
 * GET /api/geocode/reverse?lat=<lat>&lon=<lon>[&lang=es]
 *
 * Proxy de la geocodificación inversa del backend. Redondea a 4 decimales
 * (~11 m) antes de reenviar: el punto exacto no sale del navegador hacia
 * terceros y la caché se reparte mejor. Responde siempre 200 con
 * `address: null` si no hay etiqueta (o si el backend falla), y 400 si las
 * coordenadas no son válidas.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  const lat = rawLat !== null && rawLat.trim() !== '' ? Number(rawLat) : NaN;
  const lon = rawLon !== null && rawLon.trim() !== '' ? Number(rawLon) : NaN;

  if (!isValidPoint(lat, lon)) {
    return NextResponse.json({ message: 'Invalid coordinates' }, { status: 400 });
  }

  const latitude = roundCoord(lat);
  const longitude = roundCoord(lon);
  const lang = parseLangParam(params.get('lang'));

  const { data, error } = await api.GET('/geocode/reverse', {
    params: {
      query: { lat: latitude, lon: longitude, ...(lang !== null ? { lang } : {}) },
    },
  });

  if (error !== undefined || data === undefined) {
    // Sin etiqueta: el selector muestra «Punto marcado en el mapa».
    return NextResponse.json(
      { address: null, latitude, longitude },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { address: data.address ?? null, latitude, longitude },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
