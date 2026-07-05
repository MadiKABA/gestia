# Gestia

Gestia remplace le cahier papier de dettes, créances et caisse des
commerçants : qui me doit de l'argent, à qui je dois, combien j'ai en caisse.
SaaS multi-tenant, authentification téléphone + PIN, PWA offline complet.
Contexte produit complet : [CLAUDE.md](./CLAUDE.md). Architecture détaillée :
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

Next.js 16 (App Router, Turbopack, TypeScript strict) · React 19 · Tailwind
v4 + shadcn/ui · Prisma 7 + PostgreSQL · better-auth (session) + Argon2 (PIN)
· Africa's Talking (SMS/OTP) · Cloudinary (logo) · Serwist (PWA) · Vitest +
Playwright.

## Prérequis

- Node.js ≥ 20 (développé et testé avec Node 24)
- npm ≥ 10
- **PostgreSQL installé nativement en local** (pas de Docker en dev, voir plus
  bas)

## Installation locale (dev — sans Docker)

### 1. PostgreSQL natif

PostgreSQL doit tourner directement sur ta machine, pas dans un conteneur.

**macOS (Homebrew)**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

**Windows**

Installer via [le programme officiel PostgreSQL](https://www.postgresql.org/download/windows/)
(inclut pgAdmin). Le service démarre automatiquement après installation.

### 2. Créer la base de développement

```bash
# macOS / Linux
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb gestia_dev

# Windows (invite de commandes, après avoir ajouté psql au PATH)
psql -U postgres -c "CREATE DATABASE gestia_dev;"
```

### 3. Variables d'environnement

```bash
cp .env.example .env
```

Compléter `.env` (voir le tableau des variables plus bas). `DATABASE_URL` doit
déjà pointer vers `postgresql://postgres:postgres@localhost:5432/gestia_dev`
si tu as suivi l'étape précédente à l'identique.

La validation (`src/lib/env.ts`, Zod) échoue **au démarrage** si une variable
est manquante ou mal formée — message d'erreur explicite plutôt qu'un crash
en pleine requête.

### 4. Installer les dépendances et préparer la base

```bash
npm install          # installe aussi Playwright/Prisma ; postinstall régénère le client Prisma
npm run db:migrate    # applique les migrations contre gestia_dev
npm run db:seed       # crée un tenant de démo (patron : téléphone +221770000001, PIN 1234)
```

### 5. Lancer l'app

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Scripts npm

| Script                                          | Description                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                                   | Serveur de dev (Turbopack)                                               |
| `npm run build`                                 | Build de production                                                      |
| `npm run start`                                 | Démarre le build de production                                           |
| `npm run lint`                                  | ESLint                                                                   |
| `npm run format` / `format:check`               | Prettier (écrit / vérifie)                                               |
| `npm run typecheck`                             | `tsc --noEmit`                                                           |
| `npm run test` / `test:watch` / `test:coverage` | Vitest (unit + intégration)                                              |
| `npm run test:e2e`                              | Playwright                                                               |
| `npm run db:migrate`                            | `prisma migrate dev` contre le Postgres local                            |
| `npm run db:generate`                           | Régénère le client Prisma (`src/generated/prisma`)                       |
| `npm run db:studio`                             | Prisma Studio                                                            |
| `npm run db:seed`                               | Rejoue `prisma/seed.ts`                                                  |
| `npm run db:deploy`                             | `prisma migrate deploy` (utilisé en CI/prod, n'invente pas de migration) |

## Variables d'environnement

Voir [.env.example](./.env.example) pour la liste complète et commentée.
Résumé :

| Variable                                                                        | Rôle                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                  | Connexion Postgres (natif en dev, service `postgres` du compose en prod) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                         | Session (cookie signé, CSRF)                                             |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`                                            | Chiffrement des closures de Server Actions — stable entre déploiements   |
| `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SENDER_ID` | SMS/OTP                                                                  |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`          | Upload logo boutique                                                     |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`                                   | Exposées au client                                                       |

## Tests

```bash
npm run test         # unitaire (domain) + intégration (infrastructure, nécessite Postgres)
npm run test:e2e      # Playwright — build + démarre l'app automatiquement
```

Les tests d'intégration (`tests/integration/`) exécutent de vraies requêtes
Prisma contre `DATABASE_URL` : Postgres local doit être accessible.

## Déploiement en production (Docker)

**Docker est réservé au déploiement — jamais utilisé en développement local.**
Sur le VPS Ubuntu cible :

```bash
cp .env.example .env.production   # compléter avec les vraies valeurs de prod
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` démarre deux services : `app` (image construite
depuis le `Dockerfile` multi-stage) et `postgres` (volume persistant). Les
migrations sont appliquées via `db:deploy` au démarrage du conteneur `app`
(jamais `db:migrate`, qui peut générer une migration — en prod on ne fait
qu'appliquer celles déjà commitées).

## CI

`.github/workflows/ci.yml` : lint, format check, typecheck, tests et build
contre un service PostgreSQL fourni par GitHub Actions (aucun Docker
nécessaire côté CI non plus), puis un job e2e séparé (Playwright).

## Conventions

Conventional Commits (types en anglais, description en français), voir
`commitlint.config.mjs` pour les scopes autorisés. Détails complets dans
[CLAUDE.md](./CLAUDE.md#conventions-de-code).
