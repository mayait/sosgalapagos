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

/**
 * Línea de apoyo ante violencia de género (WhatsApp de una organización de
 * mujeres de Galápagos). Por pedido de la coordinación, en la página no se
 * nombra a la organización: solo el QR y el botón.
 */
export const APOYO_VIOLENCIA_WHATSAPP = 'https://wa.me/593991033741';
