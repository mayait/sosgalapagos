import { cache } from 'react';
import { api } from '@/lib/api';
import { computeInitialView, parseViewEnv, viewboxFor, type MapView } from '@/lib/geo/initial-view';

export interface EmergencyMapView {
  /** Dónde se abre el selector de ubicación; null si no hay datos ni vista por defecto. */
  initialView: MapView | null;
  /** «oeste,sur,este,norte» para dar preferencia a los resultados de la zona. */
  searchViewbox: string | null;
}

/**
 * Vista inicial del selector de ubicación para una emergencia, calculada con
 * sus puntos públicos (mediana, resistente a puntos lejanos). Si no hay
 * puntos se usa `NEXT_PUBLIC_MAP_DEFAULT_VIEW` («lat,lng,zoom»).
 *
 * Solo en Server Components. Envuelto en `cache()` para compartir la consulta
 * dentro de una misma petición.
 */
export const getEmergencyMapView = cache(async (emergencyId: string): Promise<EmergencyMapView> => {
  const fallback = parseViewEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_VIEW);
  let points: { latitude: number; longitude: number }[] = [];
  try {
    const { data } = await api.GET('/emergencies/{emergencyId}/public/resources', {
      params: { path: { emergencyId }, query: { page: 1, limit: 100 } },
    });
    points = (data?.items ?? []).map((r) => ({
      latitude: r.location.latitude,
      longitude: r.location.longitude,
    }));
  } catch {
    // Sin red con el backend: se usa la vista por defecto.
  }
  const initialView = computeInitialView(points, { radiusKm: 100, fallback });
  return { initialView, searchViewbox: initialView !== null ? viewboxFor(initialView) : null };
});
