/**
 * Videos explicativos de «Cómo funciona» (fork SOS Galápagos). Formato vertical
 * 9:16, comprimidos a 720 px con faststart. Para cambiar uno: reemplazar el
 * .mp4 y su .jpg (portada) en public/videos/ con el mismo nombre.
 */
export const VIDEO_PRINCIPAL = {
  src: '/videos/sos-galapagos.mp4',
  poster: '/videos/sos-galapagos.jpg',
  titulo: 'Qué es SOS Galápagos',
  duracion: '0:52',
} as const;

export const VIDEOS_TEMAS = [
  { src: '/videos/puntos-logisticos.mp4', poster: '/videos/puntos-logisticos.jpg', titulo: 'Puntos logísticos', duracion: '0:25' },
  { src: '/videos/necesidades.mp4', poster: '/videos/necesidades.jpg', titulo: 'Necesidades', duracion: '0:47' },
  { src: '/videos/voluntariado.mp4', poster: '/videos/voluntariado.jpg', titulo: 'Voluntariado', duracion: '0:24' },
  { src: '/videos/revisores.mp4', poster: '/videos/revisores.jpg', titulo: 'Revisores', duracion: '0:21' },
] as const;
