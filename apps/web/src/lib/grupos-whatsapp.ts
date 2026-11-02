/**
 * Grupos de WhatsApp de la respuesta en Galápagos. Para cambiar o añadir un
 * grupo, se edita esta lista y se reconstruye la web. Los enlaces van sin el
 * parámetro de seguimiento `?mode=…`, que la invitación no necesita.
 */
export const GRUPOS_WHATSAPP: readonly { nombre: string; url: string; descripcion?: string; grupos?: readonly string[] }[] = [
  {
    nombre: 'Comunidad de brigadas de Santa Cruz',
    url: 'https://chat.whatsapp.com/Ietg8wTqjCWC1X2osW7AYM',
    descripcion: 'Una comunidad con un grupo por brigada. Entra y únete a la que puedas apoyar:',
    grupos: [
      'Comida La Cascada',
      'Comida El Bosque',
      'Miramar',
      'Ropa La Cascada',
      'Ropa Divino Niño',
      'Limpieza y recolección de escombros',
    ],
  },
  {
    nombre: 'Grupo Autorganizado',
    url: 'https://chat.whatsapp.com/H5WXxdgRy1K1fYNF9nFq5j',
  },
  {
    nombre: 'Grupo Brigadas USFQ',
    url: 'https://chat.whatsapp.com/ISfiKu9iCdNEaBIfgQicg3',
  },
];

/** Apoyo ante violencia de género: WhatsApp de Magma Galápagos. */
export const APOYO_VIOLENCIA = {
  organizacion: 'Magma Galápagos',
  whatsapp: 'https://wa.me/593991033741',
  instagram: 'https://www.instagram.com/magma.gps/',
} as const;
