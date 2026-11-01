# Operación de la instancia de Galápagos

Lo propio de la emergencia de Galápagos que no es código de la plataforma: datos iniciales, arranque local y dónde se edita el contenido.

## Archivos

| Archivo | Para qué |
|---|---|
| `seed-galapagos.mjs` | Precarga por API e **idempotente**: crea o actualiza la emergencia `galapagos-2026` y carga lo demás (detalle abajo). Se puede volver a ejecutar sin duplicar nada. |
| `arrancar-local.sh` | Arranque local sin Docker (macOS + Homebrew). |

## Qué precarga `seed-galapagos.mjs`

| Elemento | Contenido |
|---|---|
| Emergencia | `galapagos-2026` con su comunicado: albergues, estado del agua, formulario del COE, clima y reglas para donar |
| Organizaciones | USFQ Galápagos y las aliadas: Funcavid, Fundación Charles Darwin, Jocotoco, Galápagos Life Fund, Galapagos Conservancy, Fundación ECOS y CAPTURGAL. Solo instituciones, sin contactos personales. |
| Puntos | Centro de acopio oficial (Colegio Miguel Ángel Cazares), 5 albergues del COE, acopio GSC en San Cristóbal, recepción de carga Viamar, Hotel Flamingo y oficina USFQ Santa Cruz |
| Necesidades | Las validadas del 31-oct y 1-nov: repelente y mosquiteros, agua, higiene, fundas para kits, ponchos, etc. |
| Tareas | Tareas de voluntariado, incluidas las de Funcavid y ECOS |
| Expediciones | GSC → Viamar |

**Ubicaciones:** las coordenadas salen de OpenStreetMap. Están marcados *por confirmar*:
- el techado del barrio Las Palmas, que está en el centro del barrio;
- la correspondencia del coliseo Segundo Chapi con el «Coliseo Cerrado de Deportes Sta. Rosa» de OSM;
- Viamar;
- la oficina USFQ Santa Cruz.

```bash
API_URL=https://sosgalapagos.org/backend ADMIN_EMAIL=… ADMIN_PASSWORD=… node galapagos/seed-galapagos.mjs
```

## Dónde se edita el contenido

| Qué | Dónde |
|---|---|
| Portada: albergues, agua, clima, lo que está en camino, organizaciones, «Cuídate» y fecha | `apps/web/src/lib/portada-galapagos.ts` |
| Grupos de WhatsApp (QR) | `apps/web/src/lib/grupos-whatsapp.ts` |
| «Qué NO hacer ahora» | `dont_bring_items` en `apps/web/src/i18n/messages/es.ts` (y `en.ts`) |
| Capas del mapa | `geodatos/scripts/capas.json` → `08_exportar.py` → `apps/web/public/capas/galapagos-2026/` |
| Áreas afectadas del COE | `areas_afectadas.geojson` (ver `geodatos/docs/05-como-actualizar.md`) |
| Marca (USFQ Galápagos × ResponseGrid) | `apps/web/src/lib/marca.ts`, `apps/web/src/app/globals.css`, `apps/web/public/marca/` |
| Necesidades, puntos, tareas y comunicado | En la propia plataforma (panel de coordinación), sin tocar código |

Después de cambiar un archivo de la web hay que volver a desplegar (`deploy/sosgalapagos/deploy.sh`).

## Privacidad

No se cargan nombres ni estados de salud de personas afectadas, ni teléfonos personales de coordinación. Las necesidades se describen de forma agregada.
