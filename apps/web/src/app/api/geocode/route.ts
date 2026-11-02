import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { parseLangParam, parseViewboxParam } from './params';

/**
 * GET /api/geocode?q=<address>[&viewbox=w,s,e,n][&lang=es]
 *
 * Proxies the backend geocoding endpoint so client components can call it
 * without hitting the backend directly (no CORS, no leaking API_URL).
 * `viewbox` only biases results towards the emergency area; `lang` asks for
 * labels in the user's language.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 200);

  if (q.length < 3) {
    return NextResponse.json([]);
  }

  const viewbox = parseViewboxParam(params.get('viewbox'));
  const lang = parseLangParam(params.get('lang'));

  const { data, error } = await api.GET('/geocode', {
    params: {
      query: {
        q,
        ...(viewbox !== null ? { viewbox } : {}),
        ...(lang !== null ? { lang } : {}),
      },
    },
  });

  if (error !== undefined || data === undefined) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data);
}
