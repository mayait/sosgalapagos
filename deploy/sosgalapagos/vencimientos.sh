#!/usr/bin/env bash
# Vencimiento automático de puntos (ofertas de comida, ropa, alojamiento,
# transporte…) que llegan de WhatsApp con fecha de caducidad.
#
# Lee /etc/sosgalapagos/vencimientos.tsv: una línea por punto con
#   <uuid del punto> TAB <vence ISO-8601> TAB <inicia ISO-8601 opcional>
# y, cada vez que corre:
#   · cierra (public_status = closed) los puntos cuyo «vence» ya pasó;
#   · activa los puntos «en preparación» cuyo «inicia» ya llegó.
# Las necesidades no lo necesitan: tienen expires_at propio y la web oculta
# las vencidas. Para prorrogar un punto, edita su fecha en el TSV.
#
# Instalación (fuera del repo, para no chocar con el git pull del deploy):
#   install -m 755 deploy/sosgalapagos/vencimientos.sh /usr/local/sbin/sosgalapagos-vencimientos
#   echo '*/10 * * * * root /usr/local/sbin/sosgalapagos-vencimientos >> /var/log/sosgalapagos-vencimientos.log 2>&1' > /etc/cron.d/sosgalapagos-vencimientos
set -euo pipefail
F=${1:-/etc/sosgalapagos/vencimientos.tsv}
[ -r "$F" ] || exit 0
cd /opt/sosgalapagos/deploy/sosgalapagos
set -a; . ./.env; set +a

# Solo pasan líneas con uuid y fechas bien formadas (mawk: sin {n}).
vals=$(awk -F'\t' '
  $1 ~ /^[0-9a-f-]+$/ && length($1) == 36 && $2 ~ /^[0-9][0-9:T.+-]+$/ {
    ini = ($3 ~ /^[0-9][0-9:T.+-]+$/) ? "'\''" $3 "'\''::timestamptz" : "NULL::timestamptz"
    printf "%s('\''%s'\''::uuid,'\''%s'\''::timestamptz,%s)", (n++ ? "," : ""), $1, $2, ini
  }' "$F")
[ -n "$vals" ] || exit 0

out=$(docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt <<SQL
with v(id, vence, inicia) as (values $vals),
cerrados as (
  update resources r set public_status = 'closed'
  from v where r.id = v.id and v.vence <= now()
    and r.public_status not in ('closed', 'hidden')
  returning r.name),
activados as (
  update resources r set public_status = 'active'
  from v where r.id = v.id and v.inicia is not null and v.inicia <= now()
    and v.vence > now() and r.public_status = 'preparing'
  returning r.name)
select 'cerrado: ' || name from cerrados
union all
select 'activado: ' || name from activados;
SQL
)
[ -z "$out" ] || printf '%s\n' "$out" | sed "s/^/$(date '+%F %T') /"
