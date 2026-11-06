#!/usr/bin/env bash
# Deja los puertos 80/443 del servidor abiertos SOLO para Cloudflare.
#
# Docker publica los puertos de Caddy con sus propias reglas de iptables y se
# salta ufw, así que el filtro va en la cadena DOCKER-USER, que Docker evalúa
# antes que las suyas. Así nadie puede saltarse Cloudflare (WAF, rate limiting)
# ni falsificar la cabecera CF-Connecting-IP. SSH (22) no se toca.
# Rangos: https://www.cloudflare.com/ips/
#
# Se instala como servicio para que se reaplique al arrancar:
#   ./firewall-cloudflare.sh --instalar
set -euo pipefail

if [ "${1:-}" = "--instalar" ]; then
  install -m 755 "$0" /usr/local/sbin/sosgalapagos-firewall
  cat > /etc/systemd/system/sosgalapagos-firewall.service <<'UNIT'
[Unit]
Description=SOS Galápagos: puertos 80/443 solo desde Cloudflare
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/sosgalapagos-firewall
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now sosgalapagos-firewall.service
  exit 0
fi

# Si no se puede bajar la lista (red caída al arrancar, Cloudflare no responde),
# se usa la última guardada y, si no hay, la de respaldo de abajo. Nunca se
# sale sin aplicar el DROP: antes, un curl fallido dejaba el origen abierto.
CACHE=/var/lib/sosgalapagos-firewall/cloudflare-ips-v4
RESPALDO="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18
108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17
162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
valida() { [ -n "$1" ] && ! printf '%s\n' $1 | grep -qvE '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$'; }
mkdir -p "$(dirname "$CACHE")"
if V4=$(curl -fsS --retry 5 --retry-delay 3 --max-time 20 https://www.cloudflare.com/ips-v4) && valida "$V4"; then
  printf '%s\n' $V4 > "$CACHE"
elif [ -s "$CACHE" ] && valida "$(cat "$CACHE")"; then
  V4=$(cat "$CACHE"); echo "aviso: sin conexión a cloudflare.com, uso la lista guardada" >&2
else
  V4=$RESPALDO; echo "aviso: sin conexión a cloudflare.com ni lista guardada, uso la de respaldo" >&2
fi
# Interfaz pública: el filtro aplica SOLO al tráfico que entra por ella. Sin -i,
# también bloquearía la salida de los contenedores hacia cualquier :443
# (descargas de npm, Let's Encrypt…).
EXT=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}' || true)
EXT=${EXT:-eth0}
iptables -N DOCKER-USER 2>/dev/null || true
iptables -F DOCKER-USER
for ip in $V4; do
  iptables -A DOCKER-USER -i "$EXT" -p tcp -m multiport --dports 80,443 -s "$ip" -j RETURN
done
iptables -A DOCKER-USER -i "$EXT" -p tcp -m multiport --dports 80,443 -j DROP
iptables -A DOCKER-USER -j RETURN
echo "DOCKER-USER ($EXT): 80/443 de entrada solo desde $(printf '%s\n' $V4 | wc -l) rangos de Cloudflare"
