'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Zoom con pellizco del trackpad (y Ctrl + rueda), como Google Maps, sin que el
 * scroll normal de la página quede atrapado en el mapa.
 *
 * En macOS el pellizco llega como evento `wheel` con `ctrlKey`. Se activa el
 * zoom con rueda de Leaflet y, en fase de captura sobre el contenedor padre, se
 * corta el `wheel` sin Ctrl para que Leaflet no lo vea: la página hace scroll
 * normal. Con Ctrl, Leaflet hace zoom y bloquea el zoom de página del navegador.
 */
export function MapPinchZoom() {
  const map = useMap();
  useEffect(() => {
    const parent = map.getContainer().parentElement;
    if (!parent) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) e.stopPropagation();
    };
    parent.addEventListener('wheel', onWheel, { capture: true });
    map.scrollWheelZoom.enable();
    return () => {
      parent.removeEventListener('wheel', onWheel, { capture: true });
      map.scrollWheelZoom.disable();
    };
  }, [map]);
  return null;
}
