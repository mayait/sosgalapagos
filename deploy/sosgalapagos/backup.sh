#!/usr/bin/env bash
# Copia diaria de Postgres. Instalar en cron:
#   15 3 * * * /opt/sosgalapagos/deploy/sosgalapagos/backup.sh
# Guarda 14 días en /var/backups/sosgalapagos. Copiar fuera del servidor
# (p. ej. a Cloudflare R2) para que sobreviva a la pérdida de la máquina.
set -euo pipefail
umask 077   # los backups contienen datos personales: solo root
cd "$(dirname "$0")"
set -a; . ./.env; set +a
DEST=/var/backups/sosgalapagos
mkdir -p "$DEST"
F="$DEST/sosgalapagos-$(date +%F-%H%M).sql.gz"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$F"
find "$DEST" -name '*.sql.gz' -mtime +14 -delete
echo "Backup: $F"
