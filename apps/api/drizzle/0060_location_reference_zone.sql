-- Ubicación: referencia privada separada de la zona pública (issue de
-- ubicación en mapa, fase 1).
--
-- location_reference : indicaciones para llegar escritas por la persona
--                      ("portón verde detrás de la escuela"). PRIVADA: solo la
--                      ve la coordinación / el dueño; nunca se expone en las
--                      lecturas públicas.
-- location_method    : cómo se marcó el punto: gps | map | search | link | zone.
-- location_accuracy  : precisión del GPS por rangos: '<50' | '50-200' | '>200'.
-- location_zone      : (solo needs) etiqueta pública de zona (barrio /
--                      localidad) calculada por el servidor a partir del punto
--                      público ajustado a la cuadrícula.
--
-- Todas nullable: las filas existentes quedan sin metadatos (legacy).

ALTER TABLE "needs"
  ADD COLUMN IF NOT EXISTS "location_reference" text,
  ADD COLUMN IF NOT EXISTS "location_method" text,
  ADD COLUMN IF NOT EXISTS "location_accuracy" text,
  ADD COLUMN IF NOT EXISTS "location_zone" text;
--> statement-breakpoint

ALTER TABLE "resources"
  ADD COLUMN IF NOT EXISTS "location_reference" text,
  ADD COLUMN IF NOT EXISTS "location_method" text,
  ADD COLUMN IF NOT EXISTS "location_accuracy" text;
--> statement-breakpoint

ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "location_reference" text,
  ADD COLUMN IF NOT EXISTS "location_method" text,
  ADD COLUMN IF NOT EXISTS "location_accuracy" text;
