# ResponseGrid web (Next.js) — imagen de producción (fork SOS Galápagos).
# El contexto de build DEBE ser la raíz del repo (monorepo pnpm):
#   docker build -f apps/web/Dockerfile -t sosgalapagos-web .
# Las variables NEXT_PUBLIC_* se incrustan en el JavaScript del navegador en el
# build, por eso entran como build args (ver deploy/sosgalapagos/docker-compose.yml).

FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_AID_BOTS_ENABLED=false
ARG NEXT_PUBLIC_SOCIAL_LOGIN=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_AID_BOTS_ENABLED=$NEXT_PUBLIC_AID_BOTS_ENABLED \
    NEXT_PUBLIC_SOCIAL_LOGIN=$NEXT_PUBLIC_SOCIAL_LOGIN

COPY . .
# `--filter=web...` instala y construye la web y sus paquetes del workspace
# (@reliefhub/api-client) en orden topológico.
RUN pnpm install --frozen-lockfile --filter=web... \
 && pnpm --filter=web... build

FROM node:22-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# El usuario node debe poder escribir la caché de Next (.next/cache).
COPY --from=builder --chown=node:node /repo /repo
WORKDIR /repo/apps/web
USER node
EXPOSE 3001
# next directamente: sin pnpm/corepack en tiempo de ejecución.
CMD ["./node_modules/.bin/next", "start", "-p", "3001"]
