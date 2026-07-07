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

## Synchronisation descendante (pull)

Symétrique à la synchronisation montante (`infrastructure/offline/sync-engine.ts`,
queue de mutations locales → serveur) : `infrastructure/offline/pull-engine.ts`
rapatrie les changements serveur → cache local. Chaque module métier
implémente un `PullHandler` (`application/offline/pull-handler.ts`) et
s'enregistre via `registerPullHandler` (`pull-handler-registry.ts`, serveur)
— le moteur générique ne connaît aucune entity. Côté client,
`registerPullableEntity` (`infrastructure/offline/pull-registry.ts`) liste
les entities à rafraîchir à chaque cycle ; c'est cette liste, pas le
registre serveur, que `network-status-store.ts` parcourt.

**Curseur** : un enregistrement IndexedDB par couple tenant/entity
(`syncCursors`, `lastSyncedAt`). Le serveur capture un `queryStartedAt`
avant chaque requête de page plutôt qu'après — une ligne écrite pendant
l'exécution est simplement re-proposée au pull suivant plutôt que risquer
d'être manquée. Le curseur n'avance côté client qu'une fois **toutes** les
pages d'un cycle appliquées avec succès ; un échec en cours de pagination
laisse le curseur intact, le cycle suivant repart du même point (fusion
idempotente, sans risque à réappliquer des enregistrements déjà à jour).

**Fusion** : toute entité ayant une mutation locale encore en attente
(`hasPendingMutationFor`) est sautée par le pull — jamais écraser une
édition optimiste pas encore poussée par une valeur serveur plus ancienne
du point de vue de l'utilisateur. Une entité `deletedAt` non nul est
retirée du cache local plutôt que gardée affichée. Les vrais conflits
(entité modifiée des deux côtés) sont résolus et tracés en AuditLog
exclusivement côté push (`sync-mutation.use-case.ts`) : au moment où le
pull s'exécute, le push du même cycle a déjà réconcilié toute mutation que
CE client tentait de pousser — le pull n'a donc jamais besoin de sa propre
détection de conflit, uniquement de rafraîchir en lecture.

**Cycle** : push puis pull, dans cet ordre, à chaque déclenchement
(`online`, retour au premier plan — `visibilitychange`, polling périodique
tant que l'app est visible et en ligne, pull manuel). Un échec du push ne
bloque pas le pull : ce sont deux opérations indépendantes. Pas de
WebSocket/SSE pour cette version — complexité disproportionnée pour
l'infra VPS actuelle (mono-instance), voir CLAUDE.md "Hors périmètre" (V2).

### Limitations iOS — à ne jamais revisiter comme un bug

**Background Sync API** (`ServiceWorkerRegistration.sync`, écouteur `sync`
dans `src/app/sw.ts`) : permet de tenter une synchronisation même app
fermée, sur Android/Chrome et dérivés Chromium. **iOS Safari (et tout
navigateur sur iOS — Chrome/Firefox iOS sont du WebKit imposé par Apple,
comme tous les navigateurs iOS) ne l'implémente pas et ne l'implémentera
sans doute jamais** — décision Apple documentée, pas une lacune de ce
projet. `infrastructure/offline/platform.ts:supportsBackgroundSync()` fait
une détection par capacité (`"SyncManager" in window`), jamais par
sniffing de user-agent : sur iOS, cette détection renvoie simplement
`false` et le code saute silencieusement l'enregistrement — aucun code
spécifique "si iOS" nécessaire, le fallback est mécanique. Sur iOS (et sur
tout navigateur sans cette API), la synchronisation ne se déclenche donc
que quand l'app est effectivement ouverte : `online`, retour au premier
plan (`visibilitychange`), polling périodique, pull manuel — ces
déclencheurs existent déjà pour tous les navigateurs, iOS n'a simplement
rien de plus.

**Même sur Android/Chrome, la Background Sync API reste "best-effort",
jamais garantie** : le navigateur peut différer, regrouper ou refuser un
événement `sync` selon batterie/data saver/heuristiques internes — rien de
comparable à une file d'attente fiable. C'est pour ça que
`mutationQueue` (IndexedDB) reste la seule source de vérité de "qu'est-ce
qui n'est pas encore synchronisé", jamais l'inverse : le SW ne fait que
tenter de la drainer plus tôt quand c'est possible, il ne remplace aucun
des déclencheurs foreground déjà en place.

**Portée du SW côté sync** : l'écouteur `sync` ne draine que le **push**
(mutations locales en attente) — jamais le pull. `pull-registry.ts` (la
liste des entities à rafraîchir) vit côté page, jamais chargé par le
bundle du service worker ; et recevoir les changements des autres postes
du tenant est moins urgent app fermée que la garantie "aucune mutation
locale perdue" que cet événement sert avant tout. Le pull continue de
dépendre exclusivement des déclencheurs foreground.

**Stockage persistant** : iOS Safari applique une politique d'éviction
d'IndexedDB plus agressive qu'Android après une période d'inactivité —
voir la section stockage persistant (à venir) pour `navigator.storage.persist()`.

**Installation** : `apple-touch-icon`, `apple-mobile-web-app-title`,
`apple-mobile-web-app-status-bar-style` sont émis par la Metadata API de
Next.js (`appleWebApp` dans `src/app/layout.tsx`) — vérifié par inspection
du HTML rendu. Next.js 16 n'émet plus que `mobile-web-app-capable` (non
préfixé, standard récent, supporté depuis iOS 17.4) — l'historique
`apple-mobile-web-app-capable` qu'Apple documente encore pour les versions
antérieures n'est plus généré automatiquement, ajouté manuellement via
`metadata.other` dans le même fichier pour ne pas dépendre d'iOS 17.4+.

## Next.js 16 — particularité à connaître

Le middleware s'appelle désormais `proxy` (`src/proxy.ts`, plus
`middleware.ts` — un fichier `middleware.ts` orphelin serait silencieusement
ignoré). Il ne fait qu'une vérification optimiste (cookie de session présent
ou non) : l'autorisation réelle (tenantId, role) est toujours revérifiée côté
serveur dans chaque Server Action via `requireTenantContext()`.
