#!/usr/bin/env bash
# Despliegue / actualización de SOS Galápagos en el servidor.
# Uso (en el servidor):  /opt/sosgalapagos/deploy/sosgalapagos/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(cd ../.. && pwd)"

[ -f .env ] || { echo "Falta deploy/sosgalapagos/.env (copiar de .env.example)"; exit 1; }

echo "→ Actualizando el código"
git -C "$REPO" pull --ff-only

echo "→ Construyendo y levantando (las migraciones corren antes que la API)"
docker compose up -d --build --remove-orphans

echo "→ Esperando a la API"
for i in $(seq 1 60); do
  if docker compose exec -T api node -e "fetch('http://localhost:3000/emergencies').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "API lista"; break
  fi
  sleep 3
  [ "$i" = 60 ] && { echo "La API no respondió"; docker compose logs --tail 80 api; exit 1; }
done

docker image prune -f >/dev/null
docker compose ps
