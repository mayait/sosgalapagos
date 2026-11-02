'use client';

import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';
import { Component, useCallback, useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n/locale-context';
import { getMessages } from '@/i18n';
import { MapPinIcon } from '@/components/atoms/map-pin-icon';
import { distanceKm, type GeoPoint } from '@/lib/geo/coordinates';
import type { MapView } from '@/lib/geo/initial-view';
import { parseLocationInput } from '@/lib/geo/parse-location-input';
import {
  INITIAL_PICKER_STATE,
  REFERENCE_MAX_LENGTH,
  locationPickerReducer,
  parseDraft,
  toDraft,
  type LocationPickerState,
} from '@/lib/geo/location-picker-state';

// Leaflet usa `window`: el mapa solo se carga en el cliente.
const LocationPickerMap = dynamic(() => import('./location-picker-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-alt" />,
});

type Variant = 'peticion' | 'registrar' | 'donar';

interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  /** Formulario donde se usa: cambia el aviso de privacidad. */
  variant: Variant;
  /** Dónde se abre el mapa (ver `getEmergencyMapView`). */
  initialView?: MapView | null;
  /** «oeste,sur,este,norte» para dar preferencia a resultados de la zona. */
  searchViewbox?: string | null;
  /** Si se indica, la ubicación se guarda en el borrador del formulario (24 h). */
  draftKey?: string;
  /** Ubicación ya marcada (p. ej. al editar un registro existente). */
  defaultValue?: { latitude: number; longitude: number; address?: string; reference?: string };
}

const WORLD_VIEW: MapView = { latitude: 0, longitude: 0, zoom: 2 };
const MARKED_ZOOM = 17;
const MAP_LOAD_TIMEOUT_MS = 8000;
const REVERSE_DEBOUNCE_MS = 800;
const LOW_ACCURACY_M = 100;
const DESKTOP_QUERY = '(min-width: 768px)';

/** Caché en memoria de la geocodificación inversa (clave: idioma + punto a 4 decimales). */
const reverseCache = new Map<string, string | null>();

const draftStorageKey = (key: string) => `rh-draft:location:${key}`;

/** Borra la ubicación guardada en el borrador (llamar tras un envío correcto). */
export function clearLocationDraft(draftKey: string): void {
  try {
    localStorage.removeItem(draftStorageKey(draftKey));
  } catch {
    // almacenamiento no disponible
  }
}

function subscribeDesktop(callback: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/** Si el código del mapa no se puede cargar (red, bloqueo), se trata como «el mapa no cargó». */
class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function initState(defaultValue: LocationPickerProps['defaultValue']): LocationPickerState {
  if (!defaultValue) return INITIAL_PICKER_STATE;
  let s = locationPickerReducer(INITIAL_PICKER_STATE, {
    type: 'set-point',
    point: { latitude: defaultValue.latitude, longitude: defaultValue.longitude },
    method: 'map',
  });
  if (defaultValue.reference) s = locationPickerReducer(s, { type: 'set-reference', value: defaultValue.reference });
  return s;
}

const OPTION_BUTTON =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-navy bg-white px-4 py-3 text-base font-semibold text-navy transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const TEXT_INPUT =
  'w-full min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function LocationPicker({
  variant,
  initialView = null,
  searchViewbox = null,
  draftKey,
  defaultValue,
}: LocationPickerProps) {
  const locale = useLocale();
  const t = getMessages(locale).locationPicker;
  const uid = useId();
  const [state, dispatch] = useReducer(locationPickerReducer, defaultValue, initState);
  const isDesktop = useIsDesktop();

  const startView = initialView ?? WORLD_VIEW;

  // ── Estado de la carga del mapa ────────────────────────────────────────────
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const mapVisible = isDesktop || state.point !== null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const anyMapMounted = mapVisible || dialogOpen;
  useEffect(() => {
    if (!anyMapMounted || mapStatus !== 'loading') return;
    const timer = setTimeout(() => setMapStatus((s) => (s === 'loading' ? 'failed' : s)), MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [anyMapMounted, mapStatus]);
  const handleMapReady = useCallback(() => setMapStatus('ready'), []);
  const handleMapError = useCallback(() => setMapStatus('failed'), []);
  const mapFailed = mapStatus === 'failed';

  // ── Geocodificación inversa (con espera, caché y cancelación) ───────────────
  useEffect(() => {
    const key = state.pendingReverseKey;
    if (key === null) return;
    const cacheKey = `${locale}:${key}`;
    const cached = reverseCache.get(cacheKey);
    const ctrl = new AbortController();
    const timer = setTimeout(
      async () => {
        if (cached !== undefined) {
          dispatch({ type: 'reverse-result', key, label: cached });
          return;
        }
        const [lat, lon] = key.split(',');
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(locale)}`,
            { signal: ctrl.signal },
          );
          if (!res.ok) throw new Error(`reverse ${res.status}`);
          const data = (await res.json()) as { address?: string | null };
          const label = typeof data.address === 'string' ? data.address : null;
          reverseCache.set(cacheKey, label);
          dispatch({ type: 'reverse-result', key, label });
        } catch {
          if (!ctrl.signal.aborted) dispatch({ type: 'reverse-failed', key });
        }
      },
      cached !== undefined ? 0 : REVERSE_DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [state.pendingReverseKey, locale]);

  // ── Borrador (24 h) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (draftKey === undefined || defaultValue !== undefined) return;
    try {
      const draft = parseDraft(localStorage.getItem(draftStorageKey(draftKey)), Date.now());
      if (draft) dispatch({ type: 'restore', snapshot: draft });
    } catch {
      // almacenamiento no disponible
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { point, method, accuracyM, zoneLabel, reference } = state;
  useEffect(() => {
    if (draftKey === undefined) return;
    const timer = setTimeout(() => {
      try {
        const key = draftStorageKey(draftKey);
        if (point === null && reference === '') localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify(toDraft({ ...INITIAL_PICKER_STATE, point, method, accuracyM, zoneLabel, reference }, Date.now())),
          );
      } catch {
        // cuota o modo privado
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draftKey, point, method, accuracyM, zoneLabel, reference]);

  // ── Foco ──────────────────────────────────────────────────────────────────
  const cardHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusCard = () => {
    // Tras el render que muestra la tarjeta.
    requestAnimationFrame(() => cardHeadingRef.current?.focus());
  };

  // ── GPS ───────────────────────────────────────────────────────────────────
  const [gps, setGps] = useState<{ status: 'idle' | 'locating' | 'error'; message?: string }>({ status: 'idle' });
  const locate = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGps({ status: 'error', message: t.gps_unsupported });
      return;
    }
    setGps({ status: 'locating' });
    const onSuccess = (pos: GeolocationPosition) => {
      dispatch({
        type: 'set-point',
        point: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        method: 'gps',
        accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
      });
      setGps({ status: 'idle' });
      focusCard();
    };
    const onError = (retried: boolean) => (err: GeolocationPositionError) => {
      // Si se agota el tiempo con alta precisión, se reintenta una vez sin ella.
      if (err.code === err.TIMEOUT && !retried) {
        navigator.geolocation.getCurrentPosition(onSuccess, onError(true), {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
        return;
      }
      const message =
        err.code === err.PERMISSION_DENIED
          ? t.gps_denied
          : err.code === err.TIMEOUT
            ? t.gps_timeout
            : t.gps_unavailable;
      setGps({ status: 'error', message });
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError(false), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  };

  // ── Búsqueda explícita (sin autocompletar, por la política de Nominatim) ────
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error';
    results: GeocodeResult[];
    message?: string;
  }>({ status: 'idle', results: [] });
  const searchAbortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearch({ status: 'error', results: [], message: t.search_too_short });
      return;
    }
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearch({ status: 'loading', results: [] });
    const params = new URLSearchParams({ q, lang: locale });
    if (searchViewbox) params.set('viewbox', searchViewbox);
    try {
      const res = await fetch(`/api/geocode?${params.toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const data = (await res.json()) as GeocodeResult[];
      const results = Array.isArray(data) ? data.slice(0, 8) : [];
      setSearch({
        status: 'done',
        results,
        message:
          results.length > 0
            ? t.search_results_count.replace('{count}', String(results.length))
            : t.search_no_results,
      });
    } catch {
      if (!ctrl.signal.aborted) setSearch({ status: 'error', results: [], message: t.search_error });
    }
  };

  const selectResult = (r: GeocodeResult) => {
    const name = r.address.split(',')[0]?.trim() ?? '';
    dispatch({
      type: 'set-point',
      point: { latitude: r.latitude, longitude: r.longitude },
      method: 'search',
      suggestion: name !== '' ? name : null,
    });
    setSearch({ status: 'idle', results: [] });
    focusCard();
  };

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // No enviar el formulario: Enter aquí busca.
      e.preventDefault();
      void runSearch();
    } else if (e.key === 'ArrowDown' && search.results.length > 0) {
      e.preventDefault();
      resultsRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  };

  const onResultsKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(resultsRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[Math.min(buttons.length - 1, idx + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) searchInputRef.current?.focus();
      else buttons[idx - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearch({ status: 'idle', results: [] });
      searchInputRef.current?.focus();
    }
  };

  // ── Enlace o coordenadas pegadas ───────────────────────────────────────────
  const [linkText, setLinkText] = useState('');
  const [link, setLink] = useState<{ status: 'idle' | 'loading' | 'error'; message?: string; help?: boolean }>({
    status: 'idle',
  });

  const applyLink = async () => {
    let parsed = parseLocationInput(linkText);
    if (parsed.kind === 'short-link') {
      setLink({ status: 'loading' });
      try {
        const res = await fetch(`/api/geocode/expand-link?url=${encodeURIComponent(parsed.url)}`);
        if (!res.ok) throw new Error(`expand ${res.status}`);
        const data = (await res.json()) as { url?: string };
        parsed = typeof data.url === 'string' ? parseLocationInput(data.url) : { kind: 'invalid', reason: 'unrecognized' };
        if (parsed.kind !== 'point') {
          setLink({ status: 'error', message: t.link_short_failed, help: true });
          return;
        }
      } catch {
        setLink({ status: 'error', message: t.link_short_failed, help: true });
        return;
      }
    }
    if (parsed.kind === 'point') {
      dispatch({
        type: 'set-point',
        point: { latitude: parsed.latitude, longitude: parsed.longitude },
        method: 'link',
      });
      setLink({ status: 'idle' });
      setLinkText('');
      focusCard();
      return;
    }
    if (parsed.kind === 'invalid') {
      setLink({
        status: 'error',
        message: parsed.reason === 'out-of-range' ? t.link_out_of_range : t.link_invalid,
        help: true,
      });
    }
  };

  // ── Mapa en línea (escritorio) ─────────────────────────────────────────────
  const inlineMapRef = useRef<LeafletMap | null>(null);
  const setInlineMap = useCallback((m: LeafletMap | null) => {
    inlineMapRef.current = m;
  }, []);
  const markInlineCenter = () => {
    const m = inlineMapRef.current;
    if (!m) return;
    const c = m.getCenter();
    dispatch({ type: 'set-point', point: { latitude: c.lat, longitude: c.lng }, method: 'map' });
  };
  const onInlineMoveEnd = useCallback((c: GeoPoint, byUser: boolean) => {
    if (byUser) dispatch({ type: 'set-point', point: c, method: 'map' });
  }, []);
  const focusInlineMap = () => {
    const container = inlineMapRef.current?.getContainer();
    container?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    container?.focus({ preventScroll: true });
  };

  // ── Diálogo a pantalla completa (celular) ──────────────────────────────────
  const openerRef = useRef<HTMLElement | null>(null);
  const openDialog = (opener: HTMLElement | null) => {
    openerRef.current = opener;
    setDialogOpen(true);
  };
  const closeDialog = (confirmed: boolean) => {
    setDialogOpen(false);
    requestAnimationFrame(() => {
      if (confirmed) cardHeadingRef.current?.focus();
      else openerRef.current?.focus();
    });
  };
  const confirmDialog = (center: GeoPoint) => {
    // Sin mover el mapa se conserva cómo se marcó (p. ej. el GPS y su precisión).
    const moved = point === null || distanceKm(point, center) > 0.002;
    if (moved) dispatch({ type: 'set-point', point: center, method: 'map' });
    closeDialog(true);
  };

  const onMarkOnMap = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (isDesktop) {
      markInlineCenter();
      focusInlineMap();
    } else {
      openDialog(e.currentTarget);
    }
  };
  const onChange = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (isDesktop) focusInlineMap();
    else openDialog(e.currentTarget);
  };

  // ── Textos derivados ──────────────────────────────────────────────────────
  const privacy =
    variant === 'peticion' ? t.privacy_peticion : variant === 'registrar' ? t.privacy_registrar : t.privacy_donar;
  const zoneText =
    zoneLabel !== null
      ? t.near.replace('{zone}', zoneLabel)
      : state.pendingReverseKey !== null
        ? t.zone_loading
        : t.marked_fallback;
  const announcement =
    point === null || state.pendingReverseKey !== null
      ? ''
      : zoneLabel !== null
        ? t.announce_marked.replace('{zone}', zoneLabel)
        : t.announce_marked_no_zone;

  const ids = {
    privacy: `${uid}-privacy`,
    search: 'location-search',
    searchStatus: `${uid}-search-status`,
    link: `${uid}-link`,
    linkHelp: `${uid}-link-help`,
    reference: `${uid}-reference`,
    referenceHelp: `${uid}-reference-help`,
    card: `${uid}-card`,
    mapHint: `${uid}-map-hint`,
  };

  return (
    <div className="flex flex-col gap-4">
      <p id={ids.privacy} className="rounded-lg bg-surface-alt px-3 py-2 text-sm text-ink-soft">
        {privacy}
      </p>

      {/* Anuncio para lectores de pantalla */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* ── Tarjeta de confirmación ── */}
      {point !== null && (
        <section
          aria-labelledby={ids.card}
          className="flex flex-col gap-3 rounded-lg border-2 border-success bg-success-soft/40 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id={ids.card}
                ref={cardHeadingRef}
                tabIndex={-1}
                className="text-base font-bold text-ink focus:outline-none"
              >
                <span aria-hidden="true">✓ </span>
                {t.marked_title} · <span className="font-semibold">{zoneText}</span>
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {t.coordinates
                  .replace('{lat}', point.latitude.toFixed(5))
                  .replace('{lng}', point.longitude.toFixed(5))}
              </p>
              {method === 'gps' && accuracyM !== null && (
                <p className="mt-1 text-sm text-ink-soft">
                  {t.gps_accuracy.replace('{meters}', String(accuracyM))}
                </p>
              )}
              {method === 'gps' && accuracyM !== null && accuracyM > LOW_ACCURACY_M && (
                <p className="mt-1 text-sm font-semibold text-warning">{t.gps_low_accuracy}</p>
              )}
            </div>
            {!mapFailed && (
              <button
                type="button"
                onClick={onChange}
                className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-bold text-navy underline underline-offset-4 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
              >
                {t.change}
              </button>
            )}
          </div>

          {/* Vista previa estática (celular): no atrapa el scroll. */}
          {!isDesktop && !mapFailed && (
            <div className="relative h-40 overflow-hidden rounded-lg border border-line">
              <MapErrorBoundary onError={handleMapError}>
                <LocationPickerMap
                  key={`${point.latitude},${point.longitude}`}
                  center={point}
                  zoom={MARKED_ZOOM}
                  interactive={false}
                  onReady={handleMapReady}
                  ariaLabel={t.preview_label}
                />
              </MapErrorBoundary>
              <button
                type="button"
                onClick={(e) => openDialog(e.currentTarget)}
                aria-label={t.preview_label}
                className="absolute inset-0 z-[700] h-full w-full bg-transparent focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-navy"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.reference} className="text-sm font-semibold text-ink">
              {t.reference_label}
            </label>
            <input
              id={ids.reference}
              name="reference"
              type="text"
              maxLength={REFERENCE_MAX_LENGTH}
              value={reference}
              onChange={(e) => dispatch({ type: 'set-reference', value: e.target.value })}
              placeholder={t.reference_placeholder}
              aria-describedby={ids.referenceHelp}
              autoComplete="off"
              className={TEXT_INPUT}
            />
            <p id={ids.referenceHelp} className="text-xs text-muted">
              {t.reference_help}
            </p>
            {state.suggestion !== null && reference === '' && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'use-suggestion' })}
                className="min-h-12 self-start rounded-full border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
              >
                {t.use_suggestion.replace('{name}', state.suggestion)}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── 1 y 2: GPS y marcar en el mapa ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={locate} disabled={gps.status === 'locating'} className={OPTION_BUTTON}>
          <GpsIcon />
          {gps.status === 'locating' ? t.locating : t.use_my_location}
        </button>
        {!mapFailed && (
          <button type="button" onClick={onMarkOnMap} className={OPTION_BUTTON}>
            <MapPinIcon className="h-5 w-4 text-accent" />
            {t.mark_on_map}
          </button>
        )}
      </div>
      {gps.status === 'error' && gps.message !== undefined && (
        <p role="alert" className="text-sm font-medium text-danger">
          {gps.message}
        </p>
      )}

      {/* ── Mapa en línea (escritorio) con pin fijo ── */}
      {isDesktop && !mapFailed && (
        <div className="flex flex-col gap-1.5">
          <div className="h-[380px] overflow-hidden rounded-lg border-2 border-line">
            <MapErrorBoundary onError={handleMapError}>
              <LocationPickerMap
                center={point ?? startView}
                zoom={point !== null ? MARKED_ZOOM : startView.zoom}
                interactive
                pinchZoomOnly
                recenter={point !== null ? { point, seq: state.recenterSeq } : null}
                onMoveEnd={onInlineMoveEnd}
                onEnter={markInlineCenter}
                onReady={handleMapReady}
                onMap={setInlineMap}
                ariaLabel={`${t.map_label} ${t.map_hint_desktop}`}
                zoomInLabel={t.zoom_in}
                zoomOutLabel={t.zoom_out}
              />
            </MapErrorBoundary>
          </div>
          <p id={ids.mapHint} className="text-xs text-muted">
            {t.map_hint_desktop}
          </p>
        </div>
      )}

      {mapFailed && (
        <p role="alert" className="rounded-lg border border-warning bg-warning-soft px-3 py-2 text-sm text-warning">
          {t.map_failed}
        </p>
      )}

      {/* ── 3: buscar un lugar conocido ── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.search} className="text-sm font-semibold text-ink">
          {t.search_known_place}
        </label>
        <div className="flex gap-2">
          <input
            id={ids.search}
            ref={searchInputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t.search_placeholder}
            aria-describedby={ids.searchStatus}
            className={TEXT_INPUT}
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={search.status === 'loading'}
            className="min-h-12 shrink-0 rounded-lg bg-navy px-5 text-base font-semibold text-white hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {search.status === 'loading' ? t.searching : t.search_button}
          </button>
        </div>
        <p
          id={ids.searchStatus}
          role="status"
          aria-live="polite"
          className={`text-sm ${search.status === 'error' ? 'text-danger' : 'text-muted'}`}
        >
          {search.status === 'loading' ? t.searching : (search.message ?? '')}
        </p>
        {search.results.length > 0 && (
          <ul
            ref={resultsRef}
            aria-label={t.search_results_label}
            onKeyDown={onResultsKeyDown}
            className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border-2 border-line bg-white"
          >
            {search.results.map((r) => (
              <li key={`${r.latitude},${r.longitude},${r.address}`}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="min-h-12 w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface focus:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy"
                >
                  {r.address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 4: enlace o coordenadas (plegado) ── */}
      <details className="group rounded-lg border border-line bg-white">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy">
          {t.link_toggle}
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <label htmlFor={ids.link} className="text-sm text-ink-soft">
            {t.link_label}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={ids.link}
              type="text"
              inputMode="url"
              autoComplete="off"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void applyLink();
                }
              }}
              placeholder={t.link_placeholder}
              aria-describedby={link.help ? ids.linkHelp : undefined}
              className={TEXT_INPUT}
            />
            <button
              type="button"
              onClick={() => void applyLink()}
              disabled={link.status === 'loading' || linkText.trim() === ''}
              className="min-h-12 shrink-0 rounded-lg border-2 border-navy bg-white px-4 text-sm font-semibold text-navy hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-50"
            >
              {link.status === 'loading' ? t.link_expanding : t.link_button}
            </button>
          </div>
          {link.status === 'error' && link.message !== undefined && (
            <p role="alert" className="text-sm font-medium text-danger">
              {link.message}
            </p>
          )}
          {link.help === true && (
            <p id={ids.linkHelp} className="text-xs text-muted">
              {t.link_help}
            </p>
          )}
        </div>
      </details>

      {/* Campos que viajan con el formulario */}
      <input type="hidden" name="address" value={zoneLabel ?? ''} />
      <input type="hidden" name="latitude" value={point !== null ? point.latitude.toFixed(6) : ''} />
      <input type="hidden" name="longitude" value={point !== null ? point.longitude.toFixed(6) : ''} />
      <input type="hidden" name="method" value={point !== null && method !== null ? method : ''} />
      <input
        type="hidden"
        name="accuracyM"
        value={point !== null && method === 'gps' && accuracyM !== null ? String(accuracyM) : ''}
      />
      {/* Sin punto la tarjeta (y su campo) no se muestra: la referencia viaja igual. */}
      {point === null && <input type="hidden" name="reference" value={reference} />}

      {dialogOpen && (
        <FullScreenPicker
          center={point ?? startView}
          zoom={point !== null ? MARKED_ZOOM : startView.zoom}
          t={t}
          onConfirm={confirmDialog}
          onCancel={() => closeDialog(false)}
          onReady={handleMapReady}
          onError={handleMapError}
        />
      )}
    </div>
  );
}

// ── Selector a pantalla completa con pin fijo (celular) ───────────────────────

type PickerMessages = ReturnType<typeof getMessages>['locationPicker'];

function FullScreenPicker({
  center,
  zoom,
  t,
  onConfirm,
  onCancel,
  onReady,
  onError,
}: {
  center: GeoPoint;
  zoom: number;
  t: PickerMessages;
  onConfirm: (center: GeoPoint) => void;
  onCancel: () => void;
  onReady: () => void;
  onError: () => void;
}) {
  const titleId = useId();
  const hintId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const setMap = useCallback((m: LeafletMap | null) => {
    mapRef.current = m;
  }, []);
  // El centro inicial se fija al abrir: los movimientos posteriores son de la persona.
  const [initial] = useState(() => ({ center, zoom }));

  const confirm = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    onConfirm({ latitude: c.lat, longitude: c.lng });
  }, [onConfirm]);

  // Bloquea el scroll de la página mientras está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    // Trampa de foco dentro del diálogo.
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[2000] flex h-[100dvh] flex-col bg-white"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 shrink-0 rounded-lg px-3 text-base font-semibold text-navy hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          {t.cancel}
        </button>
        <h2 id={titleId} className="flex-1 text-base font-bold leading-tight text-ink">
          {t.dialog_title}
        </h2>
      </div>
      <p id={hintId} className="sr-only">
        {t.dialog_keyboard_hint}
      </p>
      <div className="relative min-h-0 flex-1">
        <MapErrorBoundary onError={onError}>
          <LocationPickerMap
            center={initial.center}
            zoom={initial.zoom}
            interactive
            onEnter={confirm}
            onReady={onReady}
            onMap={setMap}
            ariaLabel={`${t.map_label} ${t.dialog_keyboard_hint}`}
            autoFocus
            zoomInLabel={t.zoom_in}
            zoomOutLabel={t.zoom_out}
          />
        </MapErrorBoundary>
      </div>
      <div className="border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={confirm}
          className="flex min-h-14 w-full items-center justify-center rounded-lg bg-accent px-6 text-lg font-bold text-white hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          {t.confirm_place}
        </button>
      </div>
    </div>,
    document.body,
  );
}
