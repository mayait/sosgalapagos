/**
 * Marca de esta instancia: fork de ResponseGrid operado por la Universidad San
 * Francisco de Quito (USFQ Galápagos) para la emergencia en Galápagos.
 *
 * ResponseGrid es software libre de Global Emergency (AGPL-3.0): su nombre, su
 * marca y el enlace al código se mantienen en la cabecera y el pie, como pide
 * la licencia. Los logos USFQ son los del sistema WE WANT MORE (lockup externo
 * «USFQ | GALÁPAGOS») y están en public/marca/.
 */
export const MARCA = {
  /** URL pública de esta instancia. */
  sitio: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosgalapagos.org',
  repositorio: 'https://github.com/mayait/sosgalapagos',
  usfq: 'Universidad San Francisco de Quito',
  usfqCorto: 'USFQ Galápagos',
  usfqSitio: 'https://www.usfq.edu.ec',
  logoOscuro: '/marca/usfq-galapagos-inverso.svg',
  logoClaro: '/marca/usfq-galapagos-color.svg',
  /** Proporción ancho/alto del lockup USFQ | GALÁPAGOS (viewBox 383,46 × 82,90). */
  logoProporcion: 383.46 / 82.9,
  plataforma: 'ResponseGrid',
  desarrollo: 'IA Humana',
  desarrolloSitio: 'https://iahumana.org',
  licencia: 'AGPL-3.0',
  licenciaUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
} as const;
