/**
 * Contenido de la portada (/) de la instancia USFQ Galápagos.
 *
 * Lo que cambia (fecha, formulario, organizaciones) se edita aquí y luego se
 * reconstruye la web. Las necesidades NO van aquí: la
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

} as const;
