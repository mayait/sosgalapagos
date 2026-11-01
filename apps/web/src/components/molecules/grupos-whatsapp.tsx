'use client';

/**
 * Grupos de WhatsApp de la respuesta en Galápagos (fork USFQ). Cada grupo se
 * muestra con su QR, para escanearlo desde otra pantalla o un cartel, y con un
 * botón para abrirlo directo desde el celular.
 */
import { QRCodeSVG } from 'qrcode.react';
import { GRUPOS_WHATSAPP } from '@/lib/grupos-whatsapp';

interface GruposWhatsappProps {
  /** id del encabezado, para aria-labelledby cuando el componente aparece más de una vez. */
  headingId?: string;
  className?: string;
}

export function GruposWhatsapp({ headingId = 'grupos-whatsapp-heading', className = '' }: GruposWhatsappProps) {
  return (
    <section aria-labelledby={headingId} className={`flex flex-col gap-3 ${className}`.trim()}>
      <div>
        <h2 id={headingId} className="font-display text-base font-bold text-navy">
          Grupos de coordinación por WhatsApp
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Escanea el código o, si estás en el celular, toca «Unirme por WhatsApp».
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GRUPOS_WHATSAPP.map((g) => (
          <div
            key={g.url}
            className="flex items-center gap-4 rounded-card border border-line bg-white p-4 sm:flex-col sm:items-stretch sm:text-center"
          >
            <div className="shrink-0 self-center rounded-lg border border-line bg-white p-2">
              <QRCodeSVG
                value={g.url}
                size={132}
                level="M"
                marginSize={0}
                title={`Código QR para unirse a ${g.nombre}`}
                className="h-[104px] w-[104px] sm:h-[132px] sm:w-[132px]"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-bold text-ink">{g.nombre}</p>
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                Unirme por WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
