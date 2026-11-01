import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Eliminar tus datos',
  alternates: { canonical: LEGAL.eliminarDatos },
};

export default function EliminarDatosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-[15px] leading-relaxed text-ink-soft [&_ol]:list-decimal [&_ol]:pl-5">
      <h1 className="text-2xl font-bold text-ink">Eliminar tus datos</h1>
      <p className="mt-2">Para borrar tu cuenta y todos tus datos de SOS Galápagos:</p>
      <ol className="mt-4 flex flex-col gap-2">
        <li>
          Escribe a <a className="font-semibold underline" href={`mailto:${LEGAL.correo}?subject=Eliminar%20mis%20datos`}>{LEGAL.correo}</a>{' '}
          con el asunto «Eliminar mis datos».
        </li>
        <li>Envíalo desde el correo de tu cuenta (o el de Google o Facebook con el que entraste).</li>
        <li>Borramos todo en un máximo de 15 días y te confirmamos por correo.</li>
      </ol>
      <p className="mt-6">
        Si entraste con Facebook, también puedes quitar el acceso en Facebook → Configuración → Apps y sitios web.
      </p>
      <p className="mt-6 text-sm">
        <Link className="font-semibold underline" href={LEGAL.privacidad}>Política de privacidad</Link>
      </p>
    </main>
  );
}
