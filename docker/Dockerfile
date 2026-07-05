# syntax=docker/dockerfile:1
# Image de PRODUCTION uniquement — le développement local n'utilise jamais
# Docker (Postgres natif, voir README). Build multi-stage : dépendances,
# build Next.js standalone, runtime minimal.

ARG NODE_VERSION=24-slim

# ---------------------------------------------------------------------------
# 1) deps — installe les dépendances npm (postinstall régénère le client Prisma,
#    a besoin de prisma/schema.prisma + prisma.config.ts déjà présents)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# argon2 (bindings natifs) a besoin d'outils de compilation si aucun binaire
# précompilé ne correspond à la plateforme cible.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2) builder — build Next.js (sortie standalone)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

# Variables factices : suffisantes pour que `next build` type-check/prerender
# sans échouer sur la validation Zod. Les vraies valeurs sont injectées au
# runtime par docker-compose.prod.yml (elles n'affectent pas le contenu du build).
ENV NODE_ENV=production \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    BETTER_AUTH_SECRET="build-time-placeholder-0000000000000000" \
    BETTER_AUTH_URL="http://localhost:3000" \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="build-time-placeholder-000000000000" \
    AFRICASTALKING_USERNAME="placeholder" \
    AFRICASTALKING_API_KEY="placeholder" \
    CLOUDINARY_CLOUD_NAME="placeholder" \
    CLOUDINARY_API_KEY="placeholder" \
    CLOUDINARY_API_SECRET="placeholder" \
    NEXT_PUBLIC_APP_URL="http://localhost:3000"

RUN npm run build

# ---------------------------------------------------------------------------
# 3) runner — image d'exécution minimale, utilisateur non-root
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
