'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { MapPinchZoom } from '@/components/organisms/map-pinch-zoom';
import { MapPinIcon } from '@/components/atoms/map-pin-icon';
import type { GeoPoint } from '@/lib/geo/coordinates';

export interface LocationPickerMapProps {
  /** Centro y zoom iniciales (después el mapa lo controla la persona). */
  center: GeoPoint;
  zoom: number;
  /** false → vista previa estática: sin arrastre, zoom ni teclado. */
  interactive: boolean;
  /** Zoom solo con pellizco o Ctrl + rueda: la página sigue haciendo scroll. */
  pinchZoomOnly?: boolean;
  /** Cuando cambia `seq`, el mapa se centra en `point`. */
  recenter?: { point: GeoPoint; seq: number; zoom?: number } | null;
  /** Al terminar un movimiento; `byUser` es false si lo provocó `recenter`. */
  onMoveEnd?: (center: GeoPoint, byUser: boolean) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  /** Al cargar la primera tesela. */
  onReady?: () => void;
  /** Acceso a la instancia (p. ej. para leer el centro al confirmar). */
  onMap?: (map: LeafletMap | null) => void;
  ariaLabel: string;
  autoFocus?: boolean;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  className?: string;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Con el pin fijo, el zoom con rueda o pellizco siempre es alrededor del centro. */
function zoomAroundCenter(map: LeafletMap): void {
  map.options.scrollWheelZoom = 'center';
}

function Controller({
  interactive,
  recenter,
  onMoveEnd,
  onEnter,
  onEscape,
  onMap,
  ariaLabel,
  autoFocus,
}: Pick<
  LocationPickerMapProps,
  'interactive' | 'recenter' | 'onMoveEnd' | 'onEnter' | 'onEscape' | 'onMap' | 'ariaLabel' | 'autoFocus'
>) {
  const map = useMap();
  // Un movimiento cuenta como de la persona solo si antes tocó, arrastró o usó
  // el teclado sobre el mapa (no por un cambio de tamaño ni por `recenter`).
  const userRef = useRef(false);
  const programmaticRef = useRef(false);
  // El estado del selector empieza con seq 0: solo un aumento posterior recentra.
  const lastSeqRef = useRef<number>(recenter?.seq ?? 0);
  // Los callbacks cambian en cada render del padre: se leen desde una ref para
  // no volver a registrar los eventos de Leaflet.
  const handlersRef = useRef({ onMoveEnd, onEnter, onEscape });
  useEffect(() => {
    handlersRef.current = { onMoveEnd, onEnter, onEscape };
  });

  useEffect(() => {
    onMap?.(map);
    return () => onMap?.(null);
  }, [map, onMap]);

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute('aria-label', ariaLabel);
    if (!interactive) {
      container.setAttribute('aria-hidden', 'true');
      container.removeAttribute('tabindex');
      return;
    }
    container.setAttribute('role', 'application');
    zoomAroundCenter(map);
    if (autoFocus) container.focus({ preventScroll: true });
  }, [map, ariaLabel, interactive, autoFocus]);

  useEffect(() => {
    if (!interactive) return;
    const onMoveEndEvt = () => {
      const byUser = userRef.current && !programmaticRef.current;
      const c = map.getCenter();
      handlersRef.current.onMoveEnd?.({ latitude: c.lat, longitude: c.lng }, byUser);
    };
    // Tocar el mapa lo centra en ese punto (el pin está fijo en el centro).
    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      map.panTo([e.latlng.lat, e.latlng.lng]);
    };
    const container = map.getContainer();
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== container) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handlersRef.current.onEnter?.();
      } else if (e.key === 'Escape' && handlersRef.current.onEscape) {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.onEscape();
      }
    };
    const markUser = () => {
      userRef.current = true;
    };
    const userEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;
    map.on('moveend', onMoveEndEvt);
    map.on('click', onClick);
    container.addEventListener('keydown', onKey);
    for (const ev of userEvents) container.addEventListener(ev, markUser, { passive: true });
    return () => {
      map.off('moveend', onMoveEndEvt);
      map.off('click', onClick);
      container.removeEventListener('keydown', onKey);
      for (const ev of userEvents) container.removeEventListener(ev, markUser);
    };
  }, [map, interactive]);

  useEffect(() => {
    if (!recenter || recenter.seq === lastSeqRef.current) return;
    lastSeqRef.current = recenter.seq;
    const target: [number, number] = [recenter.point.latitude, recenter.point.longitude];
    const current = map.getCenter();
    const zoom = recenter.zoom ?? Math.max(map.getZoom(), 16);
    if (current.lat === target[0] && current.lng === target[1] && map.getZoom() === zoom) return;
    // Sin animación, `moveend` llega dentro de setView: se marca como programático.
    programmaticRef.current = true;
    map.setView(target, zoom, { animate: false });
    programmaticRef.current = false;
  }, [map, recenter]);

  // El contenedor puede cambiar de tamaño (p. ej. al abrir el diálogo).
  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);

  return null;
}

export default function LocationPickerMap({
  center,
  zoom,
  interactive,
  pinchZoomOnly = false,
  recenter = null,
  onMoveEnd,
  onEnter,
  onEscape,
  onReady,
  onMap,
  ariaLabel,
  autoFocus = false,
  zoomInLabel,
  zoomOutLabel,
  className = 'h-full w-full',
}: LocationPickerMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  const handleMap = useCallback(
    (map: LeafletMap | null) => {
      mapRef.current = map;
      onMap?.(map);
    },
    [onMap],
  );

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className={interactive ? 'focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent' : 'pointer-events-none'}
        zoomControl={false}
        dragging={interactive}
        touchZoom={interactive ? 'center' : false}
        doubleClickZoom={interactive ? 'center' : false}
        scrollWheelZoom={interactive && !pinchZoomOnly ? 'center' : false}
        boxZoom={false}
        keyboard={interactive}
        keyboardPanDelta={100}
        attributionControl
      >
        <TileLayer
          url={TILE_URL}
          attribution={ATTRIBUTION}
          maxZoom={19}
          eventHandlers={{
            tileload: () => {
              if (readyRef.current) return;
              readyRef.current = true;
              onReadyRef.current?.();
            },
          }}
        />
        {interactive && pinchZoomOnly && <MapPinchZoom />}
        <Controller
          interactive={interactive}
          recenter={recenter}
          onMoveEnd={onMoveEnd}
          onEnter={onEnter}
          onEscape={onEscape}
          onMap={handleMap}
          ariaLabel={ariaLabel}
          autoFocus={autoFocus}
        />
      </MapContainer>

      {/* Pin fijo: la punta queda justo en el centro del mapa. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <MapPinIcon className="h-12 w-9 text-accent drop-shadow-md" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[499] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/40"
      />

      {interactive && zoomInLabel !== undefined && zoomOutLabel !== undefined && (
        <div className="absolute right-3 top-3 z-[600] flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-md">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label={zoomInLabel}
            title={zoomInLabel}
            className="flex h-12 w-12 items-center justify-center text-2xl font-bold text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy"
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label={zoomOutLabel}
            title={zoomOutLabel}
            className="flex h-12 w-12 items-center justify-center border-t border-line text-2xl font-bold text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy"
          >
            <span aria-hidden="true">−</span>
          </button>
        </div>
      )}
    </div>
  );
}
