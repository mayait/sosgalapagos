/**
 * Grupos de WhatsApp de la respuesta en Galápagos. Para cambiar o añadir un
 * grupo, se edita esta lista y se reconstruye la web. Los enlaces van sin el
 * parámetro de seguimiento `?mode=…`, que la invitación no necesita.
 */
export const GRUPOS_WHATSAPP = [
  {
    nombre: 'Grupo Autorganizado',
    url: 'https://chat.whatsapp.com/H5WXxdgRy1K1fYNF9nFq5j',
  },
  {
    nombre: 'Grupo Brigadas USFQ',
    url: 'https://chat.whatsapp.com/ISfiKu9iCdNEaBIfgQicg3',
  },
] as const;

/** Apoyo ante violencia de género: WhatsApp de Magma Galápagos. */
export const APOYO_VIOLENCIA = {
  organizacion: 'Magma Galápagos',
  whatsapp: 'https://wa.me/593991033741',
  instagram: 'https://www.instagram.com/magma.gps/',
} as const;
