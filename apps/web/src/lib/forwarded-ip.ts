import { headers } from 'next/headers';

/**
 * Reenvío de la IP real del usuario a la API (fork USFQ Galápagos).
 *
 * La web llama a la API desde el servidor (Server Components, Server Actions y
 * rutas /api/*), así que la API ve siempre la IP del contenedor web y su rate
 * limit por IP se volvería global para toda la plataforma. Con
 * `INTERNAL_PROXY_SECRET` configurado en la web y en la API, cada llamada lleva
 * la IP del usuario (`CF-Connecting-IP`, que pone Cloudflare) y el secreto
 * compartido; la API solo la acepta si el secreto coincide
 * (ver apps/api/src/shared/http/client-ip.ts).
 *
 * El servidor de origen debe aceptar tráfico solo desde Cloudflare: así nadie
 * puede falsificar `CF-Connecting-IP` saltándose el proxy.
 */
export async function forwardedIpHeaders(): Promise<Record<string, string>> {
  const secret = process.env.INTERNAL_PROXY_SECRET ?? '';
  if (secret.length < 16) return {};
  let ip: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get('cf-connecting-ip') ??
      h.get('x-real-ip') ??
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      null;
  } catch {
    // Fuera de una petición (build, tareas en segundo plano): no hay IP que reenviar.
    return {};
  }
  if (ip === null || ip === '') return {};
  return { 'x-rg-internal-token': secret, 'x-rg-client-ip': ip };
}
