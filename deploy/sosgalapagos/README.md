# Despliegue de SOS Galápagos

Un solo servidor (Debian 13, 4 vCPU, 8 GB) con Docker Compose, detrás de Cloudflare.

```
Cloudflare (proxy) ──► Caddy :443 ─┬─► web  (Next.js) :3001
                                   └─► /backend/* ─► api (NestJS) :3000
                                         postgres · redis · migraciones · uploads
```

## 1. Cloudflare

- **DNS:** `sosgalapagos.org` como registro A hacia la IP del servidor y `www` como CNAME hacia `sosgalapagos.org`. Ambos con proxy (nube naranja).
- **SSL/TLS:** modo **Full (strict)**. Caddy obtiene un certificado de Let's Encrypt en el origen.
- Recomendado:
  - Always Use HTTPS, HSTS, TLS mínimo 1.2 y DNSSEC.
  - En WAF, las reglas administradas gratuitas y una regla de rate limiting para `/login`, `/signup` y `/backend/auth/*`.
  - Cloudflare Access para `/admin`.

## 2. Servidor (una sola vez)

```bash
apt-get update && apt-get install -y ca-certificates curl git
apt-get install -y docker.io docker-compose   # paquetes de Debian
git clone https://github.com/mayait/sosgalapagos.git /opt/sosgalapagos
cd /opt/sosgalapagos/deploy/sosgalapagos
cp .env.example .env && chmod 600 .env
# rellenar .env: POSTGRES_PASSWORD, JWT_SECRET e INTERNAL_PROXY_SECRET con `openssl rand -hex 32`
./firewall-cloudflare.sh --instalar   # 80/443 solo desde Cloudflare (cadena DOCKER-USER); 22 abierto (solo con llave)
```

## 3. Desplegar y actualizar

```bash
/opt/sosgalapagos/deploy/sosgalapagos/deploy.sh
```

El script hace `git pull`, construye las imágenes y aplica las migraciones pendientes (`deploy/migrate.sh`, idempotente) antes de arrancar la API. Después espera a que la API responda.

## 4. Primera carga de datos

1. Crear la cuenta administradora: registrarse en `https://sosgalapagos.org/signup` y luego darle permisos:
   ```bash
   docker compose exec postgres psql -U sosgalapagos -d sosgalapagos \
     -c "update users set is_admin = true where email = 'correo@dominio';"
   ```
2. Precargar la emergencia (desde cualquier equipo):
   ```bash
   API_URL=https://sosgalapagos.org/backend ADMIN_EMAIL=… ADMIN_PASSWORD=… node galapagos/seed-galapagos.mjs
   ```

## 5. Operación

```bash
cd /opt/sosgalapagos/deploy/sosgalapagos
docker compose ps
docker compose logs -f api web caddy
./backup.sh                      # copia de Postgres (en cron diario: ver el script)
```

- **Copias de seguridad:** `backup.sh` guarda 14 días en `/var/backups/sosgalapagos`. Hay que copiarlas fuera del servidor, por ejemplo a Cloudflare R2.
- **Secretos:** solo en `.env` del servidor, con permisos 600. Nunca en git.
- **IP real:** la web reenvía a la API la IP del usuario (`CF-Connecting-IP`) con `INTERNAL_PROXY_SECRET`. Así el rate limit es por persona y no global. Para que esa cabecera sea confiable, el firewall solo debe aceptar tráfico web desde Cloudflare.

## 6. Iniciar sesión con Google y Facebook (opcional, apagado)

Los botones están **ocultos** mientras `SOCIAL_LOGIN` esté vacío en `.env`. Para activarlos:

**Google** (Google Cloud Console, con una cuenta institucional):
1. Crea un proyecto, por ejemplo «SOS Galápagos».
2. En **APIs y servicios → Pantalla de consentimiento de OAuth**: elige tipo *Externo*, nombre «SOS Galápagos», dominio autorizado `sosgalapagos.org` y los enlaces de privacidad y términos. Solo pide `email` y `profile`, así que no necesita verificación de Google. Publícala («En producción»).
3. En **Credenciales → Crear credenciales → ID de cliente de OAuth**: tipo *Aplicación web*, URI de redirección autorizado `https://sosgalapagos.org/backend/auth/google/callback`.
4. Copia el ID y el secreto en `.env` como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

**Facebook** (developers.facebook.com):
1. **Crear app** → caso de uso «Autenticar y solicitar datos a los usuarios con el inicio de sesión con Facebook».
2. En **Inicio de sesión con Facebook → Configuración**, URI de redirección OAuth válido: `https://sosgalapagos.org/backend/auth/facebook/callback`.
3. En **Permisos**, agrega `email`; `public_profile` viene por defecto.
4. En **Configuración básica**, completa el dominio `sosgalapagos.org`, la URL de la política de privacidad, la de eliminación de datos y el ícono. Luego pasa la app a modo **Activo** (en desarrollo solo entran los administradores de la app).
5. Copia el identificador y la clave secreta en `.env` como `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET`.

**Encender:** en `.env` pon `SOCIAL_LOGIN=google,facebook` (o solo uno) y ejecuta `./deploy.sh`. Hay que reconstruir porque la variable va dentro del JavaScript.

La cuenta se asocia por correo: si alguien ya se registró con ese email, entra a la misma cuenta. Las cookies del flujo usan la ruta `/backend/auth`, que se deduce de `OAUTH_CALLBACK_BASE`.
