import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppBar } from '@/components/organisms/app-bar';
import { GruposWhatsapp } from '@/components/molecules/grupos-whatsapp';
import { getEmergencyBySlug } from '@/lib/emergencies';
import { PORTADA } from '@/lib/portada-galapagos';

// Portada de la instancia USFQ Galápagos. Sustituye la portada genérica de
// ResponseGrid (directorio de emergencias): esta instancia atiende una sola
// emergencia. El texto fijo vive en lib/portada-galapagos.ts; las necesidades
// se leen en vivo de la plataforma.
export const dynamic = 'force-dynamic';

const TITULO = 'Gestión de Emergencias — Sociedad Civil Galápagos';
const DESCRIPCION =
  'Un solo lugar para coordinar la ayuda por las inundaciones en Santa Cruz, junto a organizaciones de la sociedad civil y en coordinación con el COE.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: '/' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: '/' },
};

const PRIORIDAD: Record<string, { texto: string; clase: string }> = {
  urgent: { texto: 'Urgente', clase: 'bg-accent text-white' },
  high: { texto: 'Alta', clase: 'bg-black text-white' },
  medium: { texto: 'Media', clase: 'border border-black text-black' },
  low: { texto: 'Baja', clase: 'border border-line-strong text-muted' },
};
const ORDEN: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const h2 = 'font-display text-lg font-black uppercase leading-[0.95] tracking-[-0.01em] text-black lg:text-xl';
const tarjeta = 'rounded-card border border-line bg-white p-5 lg:p-6';
const botonNegro =
  'inline-flex items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2';
const botonRojo =
  'inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2';
const botonBorde =
  'inline-flex items-center justify-center rounded-lg border-[1.5px] border-black bg-white px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2';

export default async function HomePage() {
  const slug = PORTADA.emergenciaSlug;
  const emergencia = await getEmergencyBySlug(slug);
  const base = `/e/${slug}`;

  const { data: necesidades } = emergencia
    ? await api.GET('/emergencies/{emergencyId}/public/needs', {
        params: { path: { emergencyId: emergencia.id }, query: { limit: '50' } },
      })
    : { data: undefined };
  const hoy = [...(necesidades ?? [])]
    .sort((a, b) => (ORDEN[a.priority] ?? 9) - (ORDEN[b.priority] ?? 9))
    .slice(0, 8);

  return (
    <main className="flex-1 bg-surface">
      {emergencia ? (
        <AppBar variant="emergency" slug={slug} emergency={{ name: emergencia.name, status: emergencia.status }} />
      ) : (
        <AppBar variant="home" />
      )}

      {/* ── Portada ─────────────────────────────────────────────────── */}
      <section className="bg-black text-white">
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-9 lg:px-8 lg:pb-14 lg:pt-12">
          <p className="inline-block bg-white px-2 py-1 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-black">
            Inundaciones · Santa Cruz, Galápagos
          </p>
          <h1 className="mt-4 font-display text-[34px] font-black uppercase leading-[0.9] tracking-[-0.01em] lg:text-[56px]">
            Gestión de
            <br />
            Emergencias
          </h1>
          <p className="mt-3 font-display text-lg font-black uppercase leading-none text-accent lg:text-2xl">
            Sociedad Civil Galápagos
          </p>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/85 lg:text-base">
            Un solo lugar para coordinar la ayuda por las inundaciones en Santa Cruz. Trabajamos junto a organizaciones
            de la sociedad civil y en coordinación con el COE.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`${base}/peticion`} className={botonRojo}>
              Necesito ayuda
            </Link>
            <Link href={`${base}/voluntario`} className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-white/85">
              Quiero ayudar
            </Link>
            <Link href={base} className="inline-flex items-center justify-center rounded-lg border-[1.5px] border-white/60 px-4 py-2.5 text-sm font-bold text-white hover:border-white">
              Ver el mapa y los puntos
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/70">
            En una emergencia, llama al{' '}
            <a href="tel:911" className="font-bold text-white underline underline-offset-2">
              ECU 911
            </a>
            .
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 lg:gap-10 lg:px-8 lg:py-10">
        {/* ── Necesitas ayuda / Quieres ayudar ──────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="necesitas-heading" className={`${tarjeta} border-t-4 border-t-accent`}>
            <h2 id="necesitas-heading" className={h2}>Si necesitas ayuda</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
              Registra tu necesidad en esta plataforma y completa el formulario oficial del COE. En una emergencia, llama
              al ECU 911.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`${base}/peticion`} className={botonNegro}>
                Registrar mi necesidad
              </Link>
              <a href={PORTADA.formularioCOE} target="_blank" rel="noopener noreferrer" className={botonBorde}>
                Formulario del COE para damnificados ↗
              </a>
            </div>
          </section>

          <section aria-labelledby="quieres-heading" className={`${tarjeta} border-t-4 border-t-black`}>
            <h2 id="quieres-heading" className={h2}>Si quieres ayudar</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
              <b>No envíes donaciones físicas desde el continente.</b> Ponen en riesgo la bioseguridad de las islas y
              saturan una logística que hoy necesitamos para medicinas y agua. Dona dinero a organizaciones con
              trazabilidad y registra aquí tu oferta de voluntariado.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`${base}/voluntario`} className={botonNegro}>
                Apuntarme como voluntario
              </Link>
              <a href="#organizaciones" className={botonBorde}>
                Dónde donar dinero
              </a>
            </div>
          </section>
        </div>

        {/* ── Lo que se necesita hoy (en vivo) ──────────────────────── */}
        <section aria-labelledby="hoy-heading" className={tarjeta}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="hoy-heading" className={h2}>Lo que se necesita hoy</h2>
            <Link href={`${base}#explore-heading`} className="text-sm font-bold text-black underline underline-offset-2 hover:text-accent">
              Ver todas las necesidades →
            </Link>
          </div>
          <p className="mt-2 text-[14px] text-ink-soft">
            Repelente, mosquiteros, artículos de higiene y agua. Lo que se pueda, cómpralo en Santa Cruz.
          </p>
          {hoy.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" role="list">
              {hoy.map((n) => {
                const p = PRIORIDAD[n.priority] ?? PRIORIDAD.medium!;
                return (
                  <li key={n.id} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${p.clase}`}>
                      {p.texto}
                    </span>
                    <span className="text-[13.5px] font-semibold leading-snug text-ink">{n.title}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Aún no hay necesidades validadas.</p>
          )}
        </section>

        {/* ── Albergues y acopio ────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-5">
          <section aria-labelledby="albergues-heading" className={`${tarjeta} md:col-span-3`}>
            <h2 id="albergues-heading" className={h2}>Albergues</h2>
            <dl className="mt-4 flex flex-col gap-3">
              {PORTADA.albergues.map((a) => (
                <div key={a.zona}>
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-accent">{a.zona}</dt>
                  <dd className="mt-0.5 text-[14.5px] leading-snug text-ink">{a.lugares.join(' · ')}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-lg bg-black px-4 py-3 text-white">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">Centro de acopio oficial</p>
              <p className="mt-0.5 font-bold">{PORTADA.acopio}</p>
            </div>
            <p className="mt-3 text-[12px] text-muted">{PORTADA.fuenteAlbergues}</p>
            <Link href={base} className="mt-3 inline-block text-sm font-bold text-black underline underline-offset-2 hover:text-accent">
              Verlos en el mapa →
            </Link>
          </section>

          <section aria-labelledby="cuidate-heading" className="rounded-card bg-accent p-5 text-white md:col-span-2 lg:p-6">
            <h2 id="cuidate-heading" className="font-display text-lg font-black uppercase leading-[0.95] lg:text-xl">
              Cuídate
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5" role="list">
              {PORTADA.cuidate.map((c) => (
                <li key={c} className="flex gap-2 text-[14.5px] font-semibold leading-snug">
                  <span aria-hidden="true">●</span>
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Agua, clima y lo que está en camino ───────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">
          <section aria-labelledby="agua-heading" className={tarjeta}>
            <h2 id="agua-heading" className={h2}>Agua</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-snug text-ink-soft" role="list">
              {PORTADA.agua.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="clima-heading" className={tarjeta}>
            <h2 id="clima-heading" className={h2}>Clima</h2>
            <p className="mt-3 text-[14px] leading-snug text-ink-soft">{PORTADA.clima}</p>
          </section>
          <section aria-labelledby="camino-heading" className={tarjeta}>
            <h2 id="camino-heading" className={h2}>En camino</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-snug text-ink-soft" role="list">
              {PORTADA.enCamino.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Organizaciones ───────────────────────────────────────── */}
        <section id="organizaciones" aria-labelledby="org-heading" className={`${tarjeta} scroll-mt-20`}>
          <h2 id="org-heading" className={h2}>Organizaciones aliadas</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
            Si quieres donar dinero, hazlo a organizaciones con trazabilidad y por sus canales oficiales.{' '}
            <b>No dones a cuentas personales.</b> Todo se coordina con el COE.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {PORTADA.organizaciones.map((o) => (
              <li key={o.nombre} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-[13.5px] font-semibold text-ink">
                {o.url ? (
                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-accent hover:underline">
                    {o.nombre} ↗
                  </a>
                ) : (
                  o.nombre
                )}
              </li>
            ))}
          </ul>
        </section>

        <GruposWhatsapp headingId="grupos-whatsapp-portada" />

        <p className="text-[12.5px] text-muted">
          Información actualizada al {PORTADA.actualizado}. Fuentes: COE Provincial y cantonal, GAD Santa Cruz, empresa
          de agua, INAMHI y organizaciones de la sociedad civil.
        </p>
      </div>
    </main>
  );
}
