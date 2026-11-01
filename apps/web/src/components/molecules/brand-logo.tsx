/**
 * BrandLogo — marca de la plataforma.
 *
 * Por defecto (cabeceras) es solo ResponseGrid: BrandMark + «ResponseGrid»,
 * con el color heredado del contenedor. Con `usfq` (pie de página) se muestra
 * el co-branding: lockup USFQ | GALÁPAGOS (sistema WE WANT MORE) + ResponseGrid.
 *
 * `tone="oscuro"` (por defecto) es para bandas negras: logo USFQ inverso
 * (letras blancas, dragón rojo). `tone="claro"` usa la versión a color.
 */
import Image from 'next/image';
import { BrandMark } from '@/components/atoms/brand-mark';
import { MARCA } from '@/lib/marca';

interface BrandLogoProps {
  /** Lado del glifo de ResponseGrid en px. */
  size?: number;
  /** Clases extra para la palabra «ResponseGrid» (tamaño/color). */
  wordmarkClassName?: string;
  className?: string;
  /** Muestra también el lockup USFQ | GALÁPAGOS (co-branding del pie). */
  usfq?: boolean;
  tone?: 'oscuro' | 'claro';
}

export function BrandLogo({
  size = 26,
  wordmarkClassName = 'text-base',
  className = '',
  usfq = false,
  tone = 'oscuro',
}: BrandLogoProps) {
  const responseGrid = (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className={`font-display font-extrabold tracking-tight ${wordmarkClassName}`.trim()}>
        {MARCA.plataforma}
      </span>
    </span>
  );
  if (!usfq) return <span className={`inline-flex items-center ${className}`.trim()}>{responseGrid}</span>;

  const alto = Math.round(size * 1.2);
  const ancho = Math.round(alto * MARCA.logoProporcion);
  return (
    <span className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <Image
        src={tone === 'oscuro' ? MARCA.logoOscuro : MARCA.logoClaro}
        alt={`${MARCA.usfq} — Galápagos`}
        width={ancho}
        height={alto}
        unoptimized
        className="block shrink-0"
        style={{ height: alto, width: 'auto' }}
      />
      <span
        aria-hidden="true"
        className={`self-stretch border-l ${tone === 'oscuro' ? 'border-white/30' : 'border-black/20'}`}
      />
      {responseGrid}
    </span>
  );
}
