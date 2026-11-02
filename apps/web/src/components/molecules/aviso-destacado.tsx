import { PORTADA } from '@/lib/portada-galapagos';

/** Aviso urgente de la coordinación (p. ej. «No necesitamos más ropa»). El texto vive en lib/portada-galapagos.ts. */
export function AvisoDestacado({ className = '' }: { className?: string }) {
  const aviso = PORTADA.aviso;
  if (!aviso) return null;
  return (
    <aside role="note" className={`rounded-card border-2 border-accent bg-accent px-4 py-3 text-white lg:px-5 ${className}`.trim()}>
      <p className="font-display text-lg font-black uppercase leading-tight lg:text-xl">{aviso.titulo}</p>
      <p className="mt-1 text-[14px] leading-snug text-white/95">{aviso.texto}</p>
    </aside>
  );
}
