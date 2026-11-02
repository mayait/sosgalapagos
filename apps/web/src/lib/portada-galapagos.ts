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
  actualizado: 'lunes 2 de noviembre de 2026, 14:15',

  /**
   * Aviso destacado en rojo arriba de la portada y de la página de la
   * emergencia. Para quitarlo, poner `aviso: null`.
   */
  aviso: {
    titulo: 'No necesitamos más ropa',
    texto:
      'Por favor, no lleves ni envíes ropa a los puntos de acopio ni a los refugios. Hoy hace falta repelente, mosquiteros, artículos de higiene y agua.',
  } as { titulo: string; texto: string } | null,

  formularioCOE:
    'https://docs.google.com/forms/d/e/1FAIpQLSe-wb4SGX8Z0IxRUCjMUBgY3XFLGGc-wwmfPux6aTaGxxOCzQ/viewform',


  /**
   * Organizaciones con trazabilidad. Cada enlace lleva a su red oficial
   * (verificada en su propio sitio web o en el perfil). Sin enlace = no se
   * encontró una cuenta oficial verificable. Nunca cuentas personales.
   */
  organizaciones: [
    {
      nombre: 'USFQ Galápagos · Galápagos Science Center',
      instagram: 'usfqgalapagos',
      // Instagram del GSC por confirmar: por ahora su página oficial de Facebook.
      enlaces: [
        { etiqueta: 'Galápagos Science Center', url: 'https://www.facebook.com/GalapagosGSC/' },
        // Campaña de donaciones de la USFQ (botón de pagos oficial de la universidad).
        { etiqueta: 'Donar · Campaña USFQ', url: 'https://btnpagos.usfq.edu.ec/pagos/eventos.aspx?adm=810110836' },
      ],
    },
    { nombre: 'Funcavid — Fundación Un Cambio por la Vida', instagram: 'fundacionuncambioxlavida' },
    { nombre: 'Fundación Charles Darwin (FCD)', instagram: 'charlesdarwinfoundation' },
    { nombre: 'Fundación Jocotoco', instagram: 'fundacion.jocotoco' },
    { nombre: 'Galápagos Life Fund', instagram: 'galapagos.life.fund' },
    { nombre: 'Galapagos Conservancy', instagram: 'galapagosconservancy' },
    { nombre: 'Fundación ECOS' },
    { nombre: 'CAPTURGAL — Cámara Provincial de Turismo de Galápagos', instagram: 'capturgal' },
  ] as { nombre: string; instagram?: string; whatsapp?: string; enlaces?: { etiqueta: string; url: string }[] }[],

  /**
   * Páginas de consulta del mismo dominio que sirve Caddy fuera de la app
   * (por eso van con <a>, no con <Link>). Ver deploy/sosgalapagos/Caddyfile.
   */
  consulta: [
    {
      titulo: 'Mapas y capas',
      ruta: '/mapas/',
      resumen:
        'Visor de las capas geográficas de la emergencia en Santa Cruz, San Cristóbal e Isabela, sin recortes e incluido el Parque Nacional.',
      contenido: [
        'Quebradas, zonas inundables, cuencas y costa baja',
        'Vías, población expuesta por isla y puntos clave',
        'Descarga en Shapefile o GeoJSON para QGIS o ArcGIS',
      ],
    },
    {
      titulo: 'Clima en vivo',
      ruta: '/clima/',
      resumen:
        'Lluvia y temperatura de las estaciones meteorológicas de Santa Cruz y San Cristóbal. Se actualiza cada 5 minutos.',
      contenido: [
        'Lluvia acumulada en 24 h por estación, en un mapa',
        'Comparación con la inundación del 30–31 de octubre',
        'Nivel de inundación por zona (preliminar, no oficial)',
      ],
    },
    {
      titulo: 'Estudios preliminares',
      ruta: '/estudios/',
      resumen:
        'Análisis topográficos e hidrológicos rápidos, con datos públicos y asistencia de IA, sin revisión profesional. Cada estudio admite comentarios.',
      contenido: [
        'Santa Cruz: cronología del 30 de octubre, lluvia medida, La Cascada, parte alta y cruces de quebradas con vías',
        'San Cristóbal: puntos potenciales de inundación',
        'No sustituyen estudios de ingeniería ni mapas oficiales',
      ],
    },
  ],

  /**
   * Donaciones para animales. Datos de pago compartidos por la coordinación de la
   * respuesta (2-nov-2026). De Juanchito solo se publica PayPal.
   */
  mascotas: [
    {
      nombre: 'Patitas Galapagueñas',
      banco: {
        banco: 'Pichincha',
        tipo: 'Cuenta transaccional',
        numero: '2203496066',
        titular: 'Fátima Samanta Walthert',
        // Llegó como «Teléfono», pero tiene formato de cédula (provincia 17).
        cedula: '1757800683',
      },
    },
    {
      nombre: 'Juanchito al Rescate Galápagos',
      paypal: 'https://paypal.me/juanchitoalrescategp',
    },
  ] as {
    nombre: string;
    banco?: { banco: string; tipo: string; numero: string; titular: string; cedula: string };
    paypal?: string;
  }[],

} as const;
