import { createResponseGridClient } from '@reliefhub/api-client';
import { forwardedIpHeaders } from '@/lib/forwarded-ip';

/**
 * Pre-configured API client — use ONLY in Server Components or Server Actions.
 * Never import this in Client Components ('use client').
 */
export const api = createResponseGridClient(
  process.env.API_URL ?? 'http://localhost:3000',
);

// Reenvía la IP real del usuario en cada llamada (ver lib/forwarded-ip.ts).
api.use({
  async onRequest({ request }) {
    for (const [k, v] of Object.entries(await forwardedIpHeaders())) request.headers.set(k, v);
    return request;
  },
});
