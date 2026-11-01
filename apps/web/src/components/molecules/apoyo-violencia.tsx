'use client';

/** Apoyo ante violencia de género: QR y botón al WhatsApp de Magma Galápagos. */
import { QRCodeSVG } from 'qrcode.react';
import { APOYO_VIOLENCIA } from '@/lib/grupos-whatsapp';

export function ApoyoViolencia({ headingId = 'apoyo-violencia-heading' }: { headingId?: string }) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex items-center gap-4 rounded-card border border-line border-l-4 border-l-accent bg-white p-4"
    >
      <div className="shrink-0 rounded-lg border border-line bg-white p-2">
        <QRCodeSVG
          value={APOYO_VIOLENCIA.whatsapp}
          size={112}
          level="M"
          marginSize={0}
          title={`Código QR para escribir a ${APOYO_VIOLENCIA.organizacion} por WhatsApp`}
          className="h-[96px] w-[96px] sm:h-[112px] sm:w-[112px]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 id={headingId} className="font-display text-base font-bold text-navy">
          Apoyo ante violencia de género
        </h2>
        <p className="text-[13.5px] leading-snug text-ink-soft">
          Si tú o una mujer cercana vive violencia física, psicológica, sexual o económica, escribe por WhatsApp a{' '}
          <a
            href={APOYO_VIOLENCIA.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink underline underline-offset-2 hover:text-accent"
          >
            {APOYO_VIOLENCIA.organizacion}
          </a>
          . Te escuchan y te orientan.
        </p>
        <p className="text-[12.5px] text-muted">Si hay peligro inmediato, llama al ECU 911.</p>
        <a
          href={APOYO_VIOLENCIA.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center justify-center rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Pedir apoyo por WhatsApp
        </a>
      </div>
    </section>
  );
}
