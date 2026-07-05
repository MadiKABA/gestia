# Architecture

Clean Architecture appliquée à Next.js App Router, en couches **layer-first**
à la racine de `src/` : `domain/` → `application/` → `infrastructure/` →
`presentation/`. Chaque couche est subdivisée par feature (`party`,
`transaction`, `payment`, `cash`, `tenant-settings`, `auth`, `audit-log`, …),
pas par type technique — pour qu'une nouvelle feature V1.5/V2/V3 se lise comme
un ensemble cohérent à travers les 4 dossiers plutôt que comme un fichier isolé
noyé dans un dossier générique.

## Arborescence

```
gestia/
├── prisma/
│   ├── schema.prisma          # source de vérité du modèle de données
│   ├── migrations/
│   └── seed.ts
├── prisma.config.ts           # config Prisma 7 (adapter pg, seed command)
│
├── src/
│   ├── app/                              # Next.js App Router — routing fin uniquement
│   │   ├── (auth)/                       # login, register(/complete), reset-pin(/confirm), premiere-connexion
│   │   ├── (dashboard)/                  # vendeurs ; tableau de bord, parties, transactions... (à construire)
│   │   ├── api/auth/[...all]/route.ts    # handler better-auth
│   │   ├── serwist/[path]/route.ts       # service worker compilé (PWA)
│   │   ├── sw.ts                         # source du service worker
│   │   └── layout.tsx / globals.css
│   ├── proxy.ts                          # ex-middleware (Next.js 16) : redirection si pas de session
│   │
│   ├── domain/                # entités + règles métier pures — ZÉRO dépendance Next/Prisma
│   │   ├── shared/             # TenantContext, DomainError/NotFoundError/ValidationError/ForbiddenError
│   │   ├── party/               party.entity.ts, validatePartyInput()
│   │   └── auth/                 pin-policy.ts, phone.ts, otp.ts
│   │
│   ├── application/           # use cases — orchestrent domain + interfaces repository
│   │   ├── shared/              AuditLogger (interface)
│   │   ├── party/                create/update/searchParties, PartyRepository (interface)
│   │   └── auth/                  use cases inscription/invite/reset PIN, Hasher/OtpSender/AuthRepository (interfaces)
│   │
│   ├── infrastructure/        # implémentations concrètes — SEUL endroit qui importe Prisma
│   │   ├── prisma/
│   │   │   ├── client.ts                    # PrismaClient + adapter pg, singleton
│   │   │   └── tenant-scoped-repository.ts  # base : injecte tenantId dans chaque where
│   │   ├── party/party.repository.ts        # PrismaPartyRepository extends TenantScopedRepository
│   │   ├── audit-log/audit-log.repository.ts
│   │   ├── auth/                # better-auth.ts, pin-auth.plugin.ts, argon2-hasher.ts,
│   │   │                        # auth.repository.ts, session.ts, sms-otp-sender.ts
│   │   └── external/             africastalking-client.ts (fetch natif), cloudinary (à ajouter avec tenant-settings)
│   │
│   ├── presentation/          # composants + Server Actions — n'appellent QUE application/
│   │   ├── shared/              components/ui (shadcn), hooks
│   │   ├── party/actions.ts     Server Actions : dérivent leur TenantContext de la session
│   │   └── auth/                 actions.ts, schemas.ts (Zod), require-role.ts (requirePatron),
│   │                             components/ (formulaires client : RequestOtpForm, LoginForm,
│   │                             OtpPinForm, CompleteRegistrationForm, VendeursPanel, AuthLayout)
│   │
│   ├── lib/                   env.ts (validation Zod fail-fast), utils.ts (cn)
│   └── config/                 (charte graphique par défaut, presets — à peupler avec tenant-settings)
│
├── tests/{unit,integration,e2e}
├── .github/workflows/ci.yml
├── docker/                     Dockerfile + docker-compose.prod.yml (prod uniquement)
└── .env.example
```

> `src/app` est le nom imposé par Next.js (routing) — pas un dossier
> `presentation/app`. Conceptuellement il appartient à la couche
> **presentation** au même titre que `src/presentation`, simplement séparé
> pour respecter la convention du framework. shadcn/ui est configuré
> (`components.json`) pour générer dans `src/presentation/shared`, pas
> `src/components`, précisément pour éviter cette confusion.

## Rôle de chaque couche

- **domain/** : types + fonctions pures. Aucun `import` de Next.js, Prisma,
  better-auth, etc. Testable sans aucun mock. Exemple : `validatePartyInput`,
  `isLockedOut`.
- **application/** : use cases (une fonction = un cas d'usage métier). Reçoit
  ses dépendances (repository, logger, hasher…) en paramètre — jamais
  d'import direct d'une implémentation concrète. Définit les interfaces que
  `infrastructure/` doit implémenter (ex: `PartyRepository`, `AuthRepository`).
- **infrastructure/** : implémentations concrètes des interfaces
  `application/` — Prisma, better-auth, clients HTTP externes, adaptateurs
  offline. C'est la seule couche qui a le droit d'importer
  `@/generated/prisma` ou `@prisma/client` (imposé par une règle ESLint
  `no-restricted-imports`, voir `eslint.config.mjs`).
- **presentation/** : Server Actions et composants. Une Server Action est le
  **composition root** : elle dérive le `TenantContext` de la session
  (`requireTenantContext()`), instancie les repositories concrets, les passe
  aux use cases, et ne contient elle-même aucune règle métier.

## Flux d'une requête (exemple : créer un tiers)

```
UI (composant client, formulaire React Hook Form + Zod)
  → Server Action  src/presentation/party/actions.ts:createPartyAction
      1. requireTenantContext()               // session → { tenantId, userId, role }
      2. new PrismaPartyRepository(tenantId)  // instancie l'implémentation concrète
      3. createParty(context, { repository, auditLogger }, input)
           → src/application/party/create-party.use-case.ts
             a. validatePartyInput(input)             // domain, pure
             b. repository.create(input)               // infrastructure → Prisma
             c. auditLogger.log(context, {...})         // AuditLog systématique
      4. revalidatePath("/parties")
```

Aucune étape n'accède à Prisma en dehors de `PrismaPartyRepository`/
`PrismaAuditLogger`. Le `tenantId` ne transite jamais comme donnée cliente :
il vient uniquement de la session (`requireTenantContext`).

## Isolation multi-tenant

`TenantScopedRepository` (`src/infrastructure/prisma/tenant-scoped-repository.ts`)
porte le `tenantId` courant et expose `scoped(where)` qui fusionne `tenantId`
dans n'importe quelle clause `where`. Tout repository métier doit en hériter
et n'utiliser **que** `this.scoped(...)` pour ses requêtes — jamais
`this.prisma.xxx.findMany({ where: {...} })` sans passer par `scoped()`. Ça
rend l'oubli du filtre structurellement impossible plutôt que dépendant de la
discipline du développeur.

Exception documentée : `src/infrastructure/auth/auth.repository.ts`
(inscription/connexion) n'hérite pas de `TenantScopedRepository` — l'auth
s'exécute avant qu'un tenantId courant n'existe (recherche par téléphone,
globalement unique, ou création du tenant lui-même).

Deuxième exception documentée, propre à la connexion : `pin-auth.plugin.ts`
n'est pas un simple adaptateur — l'endpoint `/sign-in/pin` doit rester un
plugin better-auth (seul lui peut appeler `ctx.context.internalAdapter` pour
émettre une session signée). Il délègue toute la décision métier (vérification
Argon2, verrouillage, AuditLog `auth.login_success`/`auth.login_failed`) au
use case `application/auth/login.use-case.ts`, et se limite ensuite à la
création de session + pose du cookie via `setSessionCookie`.

## Comment ajouter une nouvelle feature (ex: `transaction`)

1. `domain/transaction/` — entité(s) + règles pures (ex: calcul du statut
   EN_COURS/PARTIELLE/REGLEE à partir de `amount`/`paidAmount`).
2. `application/transaction/` — interface `TransactionRepository`, use cases
   (`createCreance`, `createDette`, `registerPayment`...). Chaque use case
   mutant appelle `AuditLogger.log(...)`.
3. `infrastructure/transaction/transaction.repository.ts` — implémente
   l'interface, étend `TenantScopedRepository`.
4. `presentation/transaction/actions.ts` — Server Actions, `use server`,
   dérivent le contexte via `requireTenantContext()`.
5. Tests : un test unitaire domain (règles pures) + un test d'intégration
   infrastructure (repository contre Postgres) minimum.

Suivre exactement le module `party` comme référence — c'est le module validé
en premier avant réplication sur les autres (créance/dette, paiement, caisse,
paramètres tenant).

## Prisma 7 — particularité à connaître

Le générateur est `prisma-client` (pas `prisma-client-js`) : plus de moteur
Rust, connexion fournie par un driver adapter (`@prisma/adapter-pg` + `pg`).
Le client est généré dans `src/generated/prisma` (gitignored, régénéré par
`pnpm db:generate`, appelé automatiquement en `postinstall`). Le
`datasource db` du schéma n'a pas d'`url` inline — elle vient de
`prisma.config.ts` (`process.env.DATABASE_URL`, chargé via `dotenv/config`).

## Next.js 16 — particularité à connaître

Le middleware s'appelle désormais `proxy` (`src/proxy.ts`, plus
`middleware.ts` — un fichier `middleware.ts` orphelin serait silencieusement
ignoré). Il ne fait qu'une vérification optimiste (cookie de session présent
ou non) : l'autorisation réelle (tenantId, role) est toujours revérifiée côté
serveur dans chaque Server Action via `requireTenantContext()`.
