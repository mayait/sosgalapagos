# Geodatos: capas cartográficas de la emergencia en Galápagos

Proceso reproducible que reúne, depura y recorta las capas de **Santa Cruz, San Cristóbal e Isabela** para el mapa de la plataforma:
- zonas inundables y susceptibilidad;
- quebradas y cuencas que drenan a los poblados;
- Parque Nacional y zona agrícola;
- zonas pobladas, vías, relieve y puntos clave.

El resultado se publica en `apps/web/public/capas/galapagos-2026/`: un GeoJSON por capa y el manifiesto `capas.json`, que define grupos, estilos, leyendas y popups. La web lo lee tal cual (ver [`../docs/capas-emergencia.md`](../docs/capas-emergencia.md)).

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/00-fuentes-oficiales.md`](docs/00-fuentes-oficiales.md) | Catálogo de fuentes y servicios probados (IGM, CGREG, SNGR, INEC, MSP, INOCAR…) |
| [`docs/01-catalogo-de-capas.md`](docs/01-catalogo-de-capas.md) | Cada capa: qué es, de dónde sale, elementos y campos |
| [`docs/02-metodologia.md`](docs/02-metodologia.md) | Cómo se calcularon la susceptibilidad (HAND), las cuencas, la costa baja y la exposición, y sus límites |
| [`docs/03-fuentes-y-licencias.md`](docs/03-fuentes-y-licencias.md) | Licencias y atribuciones obligatorias |
| [`docs/04-especificacion-capas-json.md`](docs/04-especificacion-capas-json.md) | Formato del manifiesto |
| [`docs/05-como-actualizar.md`](docs/05-como-actualizar.md) | Cómo cambiar una capa, por ejemplo las áreas afectadas del COE |

Algunos documentos se escribieron para el paquete de entrega (`datos/`, `visor/`): aquí los datos están en `export/` y en `apps/web/public/capas/galapagos-2026/`.

## Regenerar

```bash
cd geodatos
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -I scripts/01_osm.py              # descargas (OSM/Geofabrik)
.venv/bin/python -I scripts/02_osm_extraer.py descargas/osm/ecuador-latest.osm.pbf
.venv/bin/python -I scripts/03_dem.py              # Copernicus GLO-30
.venv/bin/python -I scripts/04_igm_wfs.py          # IGM 1:25 000
.venv/bin/python -I scripts/05_igm_limpiar.py
.venv/bin/python -I scripts/06_integrar.py
.venv/bin/python -I scripts/07_oficiales.py        # SNGR, INEC, CGREG (depura datos personales)
.venv/bin/python -I scripts/07b_cuencas_aportantes.py
.venv/bin/python -I scripts/08_exportar.py         # → export/galapagos/
rsync -a --exclude edificios_expuestos.geojson --exclude parque_zonificacion.geojson \
  export/galapagos/ ../apps/web/public/capas/galapagos-2026/
```

Los estilos, los grupos y qué capas se encienden por defecto se cambian en `scripts/capas.json`. Después hay que volver a correr `08`.

## Avisos

- La susceptibilidad, la costa baja, los cauces adicionales y las cuencas son un **modelo sobre un DSM de 30 m**. Sirven para priorizar, pero **no son delimitaciones oficiales**.
- Los datos crudos (`descargas/`, `capas/`, `export/`) no se suben al repositorio. Pesan cientos de MB y algunas fuentes traen datos personales, que `07_oficiales.py` y `08_exportar.py` eliminan.
- Solo se usaron servicios públicos de lectura.
