import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { parseLocationInput } from '@/lib/geo/parse-location-input';

/**
 * GET /api/geocode/expand-link?url=<enlace corto>
 *
 * Proxy de la expansión de enlaces cortos de mapas (`maps.app.goo.gl`,
 * `goo.gl/maps`). Aquí solo se comprueba que sea un enlace corto permitido;
 * la conexión (con su protección contra SSRF) la hace el backend.
 *
 * 200 `{ url }` · 400 si no es un enlace corto permitido · 422 si no se pudo
 * resolver.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = (request.nextUrl.searchParams.get('url') ?? '').trim().slice(0, 2048);
  const parsed = parseLocationInput(raw);
  if (parsed.kind !== 'short-link') {
    return NextResponse.json({ message: 'Not an allowed short link' }, { status: 400 });
  }

  const { data, error, response } = await api.GET('/geocode/expand-link', {
    params: { query: { url: parsed.url } },
  });

  if (error !== undefined || data === undefined) {
    const status = response.status === 400 ? 400 : 422;
    return NextResponse.json({ message: 'Link could not be resolved' }, { status });
  }

  return NextResponse.json({ url: data.url });
}
