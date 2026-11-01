#!/usr/bin/env bash
# Arranque local para desarrollo, sin Docker (macOS + Homebrew):
# Postgres 17 y Redis de Homebrew, API en :3000 y web en :3001 (modo producción,
# porque el mapa de Leaflet solo se valida bien con `next start`).
#   ./galapagos/arrancar-local.sh            # arranca
#   ./galapagos/arrancar-local.sh --rebuild  # reconstruye la web antes
# Requiere apps/api/.env y apps/web/.env.local (ver los .env.example).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.local/logs"
mkdir -p "$LOGS"
brew services start postgresql@17 >/dev/null
brew services start redis >/dev/null
cd "$ROOT"
pkill -f "nest start" 2>/dev/null || true
pkill -f next-server 2>/dev/null || true
nohup pnpm --filter api start:dev > "$LOGS/api.log" 2>&1 &
if [ "${1:-}" = "--rebuild" ]; then pnpm --filter web build; fi
nohup pnpm --filter web start > "$LOGS/web.log" 2>&1 &
echo "Esperando a la API…"
for i in $(seq 1 40); do curl -sf localhost:3000/emergencies >/dev/null && break; sleep 3; done
echo "Listo → http://localhost:3001   (logs en $LOGS)"
