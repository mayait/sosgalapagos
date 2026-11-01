import { type NextRequest, NextResponse } from 'next/server';
import { getToken, authHeaders } from '@/lib/auth';
import { forwardedIpHeaders } from '@/lib/forwarded-ip';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

/**
 * POST /api/upload
 *
 * Thin proxy: receives multipart/form-data from the client (which cannot
 * access the httpOnly `rh_token` cookie), reads the token server-side,
 * and forwards the file to the backend POST /files endpoint.
 *
 * Returns the same JSON the backend returns: { key?, url? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken();
  if (token === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('file', file);

  const res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: { ...authHeaders(token), ...(await forwardedIpHeaders()) },
    body: upstream,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: res.status },
    );
  }

  const data: unknown = await res.json();
  return NextResponse.json(data, { status: 201 });
}
