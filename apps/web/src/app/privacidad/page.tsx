import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  alternates: { canonical: LEGAL.privacidad },
};

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-[15px] leading-relaxed text-ink-soft [&_h2]:mt-6 [&_h2]:font-bold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-2xl font-bold text-ink">Política de privacidad</h1>
      <p className="text-xs text-muted-soft">Actualizada el {LEGAL.actualizado}</p>

      <h2>Quién es responsable</h2>
      <p>
        Human Centric SAS BIC (IA Humana), la empresa que desarrolla y opera SOS Galápagos. La coordinación de la
        ayuda la hace USFQ Galápagos con las organizaciones aliadas.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Lo que pones en los formularios (cuenta, voluntariado, donaciones): nombre, correo y teléfono.</li>
        <li>Como voluntario, además: tus habilidades, disponibilidad y vehículo.</li>
        <li>Si entras con Google o Facebook, solo recibimos tu nombre y correo.</li>
        <li>
          La ubicación que marcas al pedir ayuda, registrar un punto u ofrecer una donación, y la referencia para llegar
          si la escribes.
        </li>
      </ul>

      <h2>Para qué</h2>
      <p>Solo para coordinar la ayuda de esta emergencia. No vendemos ni cedemos tus datos, y no los usamos para publicidad.</p>

      <h2>Quién los ve</h2>
      <p>Solo el equipo de coordinación. Lo que publicas (necesidades, puntos de acopio) es público, sin datos personales.</p>

      <h2>La ubicación de las peticiones</h2>
      <p>
        El punto exacto que marcas al pedir ayuda y la referencia para llegar solo los ve el equipo de coordinación. En
        el mapa público solo aparece la zona aproximada, un círculo de unos 500 metros, nunca el punto exacto. Los puntos
        de acopio sí se publican en su lugar exacto, para que la gente pueda llegar.
      </p>

      <h2>Servicios de terceros</h2>
      <ul>
        <li>
          El mapa usa OpenStreetMap: tu navegador descarga las imágenes del mapa desde sus servidores, que ven tu
          dirección IP como cualquier página web.
        </li>
        <li>
          Para buscar lugares y nombrar la zona usamos Nominatim, de OpenStreetMap. Lo consultamos desde nuestro
          servidor y solo le enviamos el texto que buscas o coordenadas redondeadas (a unos 10 metros), sin tus datos.
        </li>
        <li>«Usar mi ubicación» solo funciona si das permiso en tu teléfono o navegador.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Según la Ley Orgánica de Protección de Datos Personales del Ecuador, puedes pedir ver, corregir o borrar tus datos
        escribiendo a <a className="font-semibold underline" href={`mailto:${LEGAL.correo}`}>{LEGAL.correo}</a>. Ver{' '}
        <Link className="font-semibold underline" href={LEGAL.eliminarDatos}>cómo eliminar tus datos</Link>.
      </p>

      <h2>Cuánto tiempo</h2>
      <p>
        Mientras dure la emergencia. Después borramos o anonimizamos los datos personales, incluidos el punto exacto y la
        referencia de las peticiones. Si marcas una ubicación en un formulario y no lo envías, queda guardada solo en tu
        navegador y se borra a las 24 horas o al enviarlo.
      </p>
    </main>
  );
}
