#!/usr/bin/env bash
# Deja los puertos 80/443 abiertos SOLO para Cloudflare y el 22 para SSH.
# Así nadie puede saltarse Cloudflare (WAF, rate limiting) ni falsificar la
# cabecera CF-Connecting-IP. Rangos: https://www.cloudflare.com/ips/
set -euo pipefail
apt-get install -y ufw >/dev/null
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from "$ip" to any port 80,443 comment cloudflare >/dev/null
done
ufw --force enable
ufw status | head -5
