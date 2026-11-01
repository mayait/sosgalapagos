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
After=docker.service
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

V4=$(curl -fsS https://www.cloudflare.com/ips-v4)
# Interfaz pública: el filtro aplica SOLO al tráfico que entra por ella. Sin -i,
# también bloquearía la salida de los contenedores hacia cualquier :443
# (descargas de npm, Let's Encrypt…).
EXT=$(ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')
iptables -N DOCKER-USER 2>/dev/null || true
iptables -F DOCKER-USER
for ip in $V4; do
  iptables -A DOCKER-USER -i "$EXT" -p tcp -m multiport --dports 80,443 -s "$ip" -j RETURN
done
iptables -A DOCKER-USER -i "$EXT" -p tcp -m multiport --dports 80,443 -j DROP
iptables -A DOCKER-USER -j RETURN
echo "DOCKER-USER ($EXT): 80/443 de entrada solo desde $(echo "$V4" | wc -l) rangos de Cloudflare"
