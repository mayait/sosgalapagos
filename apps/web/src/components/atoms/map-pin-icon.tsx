interface MapPinIconProps {
  className?: string;
}

/**
 * Pin de mapa en SVG propio (sin depender de imágenes de un CDN). La punta
 * queda en el centro del borde inferior del icono.
 */
export function MapPinIcon({ className = 'h-12 w-9 text-accent' }: MapPinIconProps) {
  return (
    <svg viewBox="0 0 36 48" className={className} aria-hidden="true" focusable="false">
      <path
        d="M18 1C8.6 1 1 8.4 1 17.6 1 29.8 18 47 18 47s17-17.2 17-29.4C35 8.4 27.4 1 18 1z"
        fill="currentColor"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle cx="18" cy="17.5" r="6.5" fill="#ffffff" />
    </svg>
  );
}
