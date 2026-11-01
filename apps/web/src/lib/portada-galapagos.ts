/**
 * Contenido de la portada (/) de la instancia USFQ Galápagos.
 *
 * Lo que cambia a diario (albergues, agua, clima, lo que está en camino) se
 * edita aquí y luego se reconstruye la web. Las necesidades NO van aquí: la
 * portada las lee en vivo de la plataforma (necesidades validadas de la
 * emergencia), igual que los puntos del mapa.
 *
 * Regla: no publicar contactos personales. Solo instituciones.
 */
export const PORTADA = {
  emergenciaSlug: 'galapagos-2026',
  actualizado: 'domingo 1 de noviembre de 2026, 12:20',

  formularioCOE:
    'https://docs.google.com/forms/d/e/1FAIpQLSe-wb4SGX8Z0IxRUCjMUBgY3XFLGGc-wwmfPux6aTaGxxOCzQ/viewform',

  albergues: [
    { zona: 'Puerto Ayora', lugares: ['Colegio Nacional Galápagos (Miraflores)', 'Colegio Miguel Ángel Cazares', 'Iglesia de Jesucristo de los Santos de los Últimos Días'] },
    { zona: 'Bellavista', lugares: ['Techado del barrio Las Palmas'] },
    { zona: 'Santa Rosa', lugares: ['Coliseo Segundo Chapi'] },
  ],
  acopio: 'Colegio Miguel Ángel Cazares',
  fuenteAlbergues: 'Comunicado del COE Provincial y del GAD Santa Cruz. El GAD definirá más puntos.',

  agua: [
    'La captación de La Camiseta ya funciona.',
    'Puerto Ayora tendrá distribución parcial cuando se llenen los tanques de El Mirador.',
    'Bellavista, sus alrededores y El Mirador siguen sin servicio.',
    'La entrega en hidrantes para tanqueros está suspendida.',
  ],
  clima:
    'El INAMHI pronostica lluvia fuerte en Santa Cruz e Isabela. El riesgo está en la parte alta, que alimenta las encañadas.',

  enCamino: [
    'La Cámara de Industrias envía agua y alimentos en vuelos solidarios: hoy llegan 1.900 botellones a las 15:00.',
    'La SNGR envía medicinas en el avión Hércules.',
  ],

  /** Campaña de donaciones de la USFQ (botón de pagos oficial de la universidad). */
  donacionUSFQ: 'https://btnpagos.usfq.edu.ec/pagos/eventos.aspx?adm=810110836',

  /**
   * Organizaciones con trazabilidad. Cada enlace lleva a su red oficial
   * (verificada en su propio sitio web o en el perfil). Sin enlace = no se
   * encontró una cuenta oficial verificable. Nunca cuentas personales.
   */
  usfq: {
    nombre: 'USFQ Galápagos · Galápagos Science Center',
    redes: [
      { etiqueta: 'Instagram USFQ Galápagos', url: 'https://www.instagram.com/usfqgalapagos/' },
      // Instagram del GSC por confirmar: por ahora su página oficial de Facebook.
      { etiqueta: 'Galápagos Science Center', url: 'https://www.facebook.com/GalapagosGSC/' },
    ],
  },
  organizaciones: [
    { nombre: 'Funcavid — Fundación Un Cambio por la Vida', instagram: 'fundacionuncambioxlavida' },
    { nombre: 'Fundación Charles Darwin (FCD)', instagram: 'charlesdarwinfoundation' },
    { nombre: 'Fundación Jocotoco', instagram: 'fundacion.jocotoco' },
    { nombre: 'Galápagos Life Fund', instagram: 'galapagos.life.fund' },
    { nombre: 'Galapagos Conservancy', instagram: 'galapagosconservancy' },
    { nombre: 'Fundación ECOS' },
    { nombre: 'CAPTURGAL — Cámara Provincial de Turismo de Galápagos', instagram: 'capturgal' },
  ] as { nombre: string; instagram?: string }[],

  cuidate: [
    'Toma solo agua embotellada, hervida o clorada.',
    'Usa repelente y mosquitero: hay riesgo de dengue.',
    'No cruces zonas inundadas.',
  ],
} as const;
