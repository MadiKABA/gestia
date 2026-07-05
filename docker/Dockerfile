# syntax=docker/dockerfile:1
# Image de PRODUCTION uniquement — le développement local n'utilise jamais
# Docker (Postgres natif, voir README). Build multi-stage : dépendances,
# build Next.js, dépendances de prod seules, runtime minimal.

ARG NODE_VERSION=24-slim

# ---------------------------------------------------------------------------
# 1) deps — installe TOUTES les dépendances pnpm (postinstall régénère le
#    client Prisma, a besoin de prisma/schema.prisma + prisma.config.ts)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# argon2 (bindings natifs) a besoin d'outils de compilation si aucun binaire
# précompilé ne correspond à la plateforme cible.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2) builder — build Next.js
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN corepack enable

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

RUN pnpm build

# ---------------------------------------------------------------------------
# 3) prod-deps — dépendances de production uniquement (sans devDependencies)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
# --ignore-scripts : le CLI Prisma (devDependency) n'est pas installé ici, le
# postinstall `prisma generate` échouerait. Le client déjà généré est copié
# depuis le stage deps juste après.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=deps /app/src/generated ./src/generated

# ---------------------------------------------------------------------------
# 4) runner — image d'exécution minimale, utilisateur non-root
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN chown -R nextjs:nodejs .next

USER nextjs
EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
