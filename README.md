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
- pnpm ≥ 10 (`corepack enable` suffit à l'installer — la version exacte est
  épinglée dans `package.json` via `packageManager`)
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
pnpm install         # installe aussi Playwright/Prisma ; postinstall régénère le client Prisma
pnpm db:migrate      # applique les migrations contre gestia_dev
pnpm db:seed         # crée un tenant de démo (patron : téléphone +221770000001, PIN 1234)
```

### 5. Lancer l'app

```bash
pnpm dev
```

→ [http://localhost:3000](http://localhost:3000)

## Scripts

| Script                                       | Description                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                   | Serveur de dev (Turbopack)                                               |
| `pnpm build`                                 | Build de production                                                      |
| `pnpm start`                                 | Démarre le build de production                                           |
| `pnpm lint`                                  | ESLint                                                                   |
| `pnpm format` / `format:check`               | Prettier (écrit / vérifie)                                               |
| `pnpm typecheck`                             | `tsc --noEmit`                                                           |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest (unit + intégration)                                              |
| `pnpm test:e2e`                              | Playwright                                                               |
| `pnpm db:migrate`                            | `prisma migrate dev` contre le Postgres local                            |
| `pnpm db:generate`                           | Régénère le client Prisma (`src/generated/prisma`)                       |
| `pnpm db:studio`                             | Prisma Studio                                                            |
| `pnpm db:seed`                               | Rejoue `prisma/seed.ts`                                                  |
| `pnpm db:deploy`                             | `prisma migrate deploy` (utilisé en CI/prod, n'invente pas de migration) |

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
pnpm test            # unitaire (domain) + intégration (infrastructure, nécessite Postgres)
pnpm test:e2e         # Playwright — build + démarre l'app automatiquement
```

Les tests d'intégration (`tests/integration/`) exécutent de vraies requêtes
Prisma contre `DATABASE_URL` : Postgres local doit être accessible.

## Tester la PWA en local

Le service worker (Serwist) est **désactivé en dev** (`pnpm dev`) — comportement
volontaire, évite les soucis de cache pendant le développement. Pour tester
l'installabilité, le précache et le mode hors-ligne, il faut un build de
production :

```bash
pnpm build
pnpm start
```

→ [http://localhost:3000](http://localhost:3000) (`localhost` est traité comme
un contexte sécurisé par les navigateurs, HTTPS n'est nécessaire qu'en dehors
de `localhost`, ex. test sur un téléphone via l'IP du réseau local).

- **Android/Chrome/Edge** : l'invite d'installation apparaît automatiquement à
  l'ouverture (bandeau en haut d'écran) dès que `beforeinstallprompt` est
  disponible. Chrome DevTools → onglet **Application** → **Manifest** /
  **Service Workers** pour inspecter l'installabilité et le cache.
- **iOS Safari** : `beforeinstallprompt` n'existe pas sur iOS — le bandeau
  affiche à la place les instructions manuelles ("Appuyez sur Partager, puis
  « Sur l'écran d'accueil »"). Teste sur un vrai appareil ou le simulateur
  iOS (Safari ne s'exécute pas dans Chrome DevTools device mode).
- **Mode hors-ligne** : DevTools → Network → Offline, puis navigue vers une
  page non précachée → doit afficher `public/offline.html`, jamais une erreur
  navigateur brute.
- Le bandeau d'installation ne réapparaît pas après un clic sur "Plus tard"
  dans la même session (`sessionStorage`) mais revient à la prochaine visite
  si l'app n'est toujours pas installée.

## Déploiement en production (Docker)

**Docker est réservé au déploiement — jamais utilisé en développement local.**
Sur le VPS Ubuntu cible :

```bash
cp .env.example .env.production          # compléter avec les vraies valeurs de prod
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` définit trois services : `postgres` (volume
persistant), `migrate` (job ponctuel qui applique les migrations déjà
commitées via `prisma migrate deploy` — jamais `migrate dev`, qui pourrait en
générer une nouvelle) et `app` (image construite depuis le `Dockerfile`
multi-stage). Relancer `migrate` à chaque déploiement qui ajoute une
migration, avant de redémarrer `app`.

## CI

`.github/workflows/ci.yml` : lint, format check, typecheck, tests et build
contre un service PostgreSQL fourni par GitHub Actions (aucun Docker
nécessaire côté CI non plus), puis un job e2e séparé (Playwright).

## Conventions

Conventional Commits (types en anglais, description en français), voir
`commitlint.config.mjs` pour les scopes autorisés. Détails complets dans
[CLAUDE.md](./CLAUDE.md#conventions-de-code).
