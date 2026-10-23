# Imagem de produção do Emprego Agora (Next.js + Prisma).
# Build:  docker build --build-arg APP_URL=https://seu-dominio -t emprego-agora .
# Run:    docker run --env-file .env.production -p 3000:3000 emprego-agora
# Migrações (antes de subir uma nova versão): docker run --env-file .env.production emprego-agora npx prisma migrate deploy

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
# APP_URL no build define diretivas exclusivas de HTTPS (HSTS, upgrade-insecure-requests).
ARG APP_URL=https://example.invalid
ENV APP_URL=$APP_URL NEXT_TELEMETRY_DISABLED=1
# Variáveis NEXT_PUBLIC_* (dados do controlador nos documentos legais) são embutidas no build.
ARG NEXT_PUBLIC_CONTROLLER_NAME= NEXT_PUBLIC_CONTROLLER_CNPJ= NEXT_PUBLIC_CONTROLLER_ADDRESS= NEXT_PUBLIC_DPO_NAME= NEXT_PUBLIC_DPO_EMAIL= NEXT_PUBLIC_CONTACT_EMAIL= NEXT_PUBLIC_ANALYTICS_SCRIPT_URL= NEXT_PUBLIC_ANALYTICS_DOMAIN=
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 STORAGE_DIR=/data/storage
RUN groupadd --system app && useradd --system --gid app --home /app app \
  && mkdir -p /data/storage && chown -R app:app /data
COPY --from=build --chown=app:app /app/package.json /app/next.config.ts /app/prisma.config.ts ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/src/generated ./src/generated
USER app
VOLUME ["/data/storage"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "-p", "3000"]
