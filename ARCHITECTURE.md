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

## Synchronisation montante (push) et `OfflineFirstRepository<T>`

Chaque module métier retrofité sur la couche offline (Party aujourd'hui,
Transaction ensuite) expose côté présentation un repository qui implémente
`OfflineFirstRepository<T, TInput, TFilters = void>`
(`application/offline/offline-first-repository.ts`) :

```ts
interface OfflineFirstRepository<T, TInput, TFilters = void> {
  create(data: TInput): Promise<T>;
  update(id: string, data: TInput): Promise<T>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<T | null>;
  list(filters: TFilters): Promise<T[]>;
}
```

Contrat commun à toute écriture/lecture locale-first, jamais un accès
direct à Prisma ni à une Server Action de mutation depuis la
présentation : chaque méthode lit/écrit le cache local (`localCache`) et
enfile la mutation correspondante dans `mutationQueue`
(`infrastructure/offline/{local-cache,mutation-queue}.store.ts`), avant de
nudger un cycle de sync (`onSyncNeeded`, jamais attendu par l'appelant).
`TFilters` vaut `void` par défaut pour un module sans recherche/filtre
côté liste.

Implémentation de référence : `PartyOfflineRepository`
(`infrastructure/party/party-offline.repository.ts`) implémente
`OfflineFirstRepository<PartyWithBalance, PartyInput, PartySearchQuery>` —
c'est le modèle à suivre pour tout futur module (même don Party : cache
optimiste, `clientKnownUpdatedAt` du cache capturé avant toute mutation,
jamais recalculé après coup).

Côté serveur, le pendant symétrique est le `MutationHandler`
(`application/offline/mutation-handler.ts`, cf. `partyMutationHandler`) —
seule cible réelle des mutations, jamais appelé autrement que par le
moteur de sync générique (`sync-mutation.use-case.ts`), qui valide au
passage le payload avec le schéma Zod enregistré pour l'entity
(`mutation-schema-registry.ts`, ex. `partySyncPayloadSchema`) avant tout
appel au handler.

### Trois catégories d'erreur pendant le push

`sync-engine.ts:syncQueue` distingue trois catégories d'erreur renvoyées par
le serveur, chacune avec une conséquence différente sur la boucle de retry —
tout futur module qui ajoute une vérification de dépendance référentielle
(ex. `findById` d'une entité référencée avant écriture, comme
`create-transaction.use-case.ts` pour `Party` ou
`register-payment.use-case.ts` pour `Transaction`) doit lever la bonne
catégorie plutôt qu'un `Error` générique, pour hériter automatiquement du
bon comportement :

1. **Transitoire** (réseau, serveur indisponible, `rate_limited`) — un
   `Error` générique (ou tout rejet non classifié) : arrête tout le cycle en
   cours (`return` immédiat), backoff exponentiel (`computeBackoffDelayMs`),
   jamais de perte — la mutation reste intacte pour le prochain cycle.
2. **Définitive** (`ValidationError`, ex. "montant supérieur au solde
   restant") — ce payload ne deviendra jamais valide en le renvoyant tel
   quel : `markMutationPermanentlyFailed` immédiatement, la boucle continue
   avec les mutations suivantes du même passage, visible dans l'interface de
   résolution (`sync-failures-panel.tsx`) pour une action manuelle
   (`discardMutation`).
3. **Dépendance introuvable** (`DependencyNotFoundError`, distincte de
   `ValidationError` bien qu'elle hérite de `NotFoundError` — ex. `partyId`
   d'une Transaction créée hors ligne dans la même session, pas encore
   synchronisée elle-même) — ni transitoire ni définitive : la mutation
   référencée peut très bien être plus loin dans la même queue, pas encore
   traitée à ce rang à cause d'une collision de `createdAt` à la
   milliseconde près (`listPendingMutations` retombe alors sur l'ordre
   IndexedDB — id de mutation, essentiellement aléatoire — jamais l'ordre
   d'insertion réel). `syncQueue` reporte cette mutation en fin de passage
   courant (au lieu d'arrêter tout le cycle comme une erreur transitoire, ce
   qui empêcherait la dépendance elle-même d'être atteinte) et la retente une
   fois en fin de passage. Si elle échoue encore,
   `dependencyDeferredCycles` (`MutationQueueRecord`, `db.ts`) est
   incrémenté ; en dessous de `MAX_DEPENDENCY_DEFER_CYCLES` (5), elle reste
   en attente pour le prochain cycle complet ; au seuil, elle bascule comme
   une erreur définitive vers l'interface de résolution, avec un message
   dédié ("En attente d'une autre donnée non encore synchronisée") qui la
   distingue d'une erreur de validation classique.

Propagation de bout en bout : `DependencyNotFoundError` (use case
applicatif) → `{ok:false, reason:"dependency_not_found", message}`
(`SyncActionResult`, `syncMutationAction`/`/api/sync`, statut HTTP 409) →
`DependencyPendingError` (`infrastructure/offline/errors.ts`, classification
interne au client) → traitement décrit ci-dessus dans `syncQueue`. Le
chemin online-first (`attemptOnlineMutation`) reçoit la même distinction
mais la traite comme une erreur de validation (rejet immédiat, jamais mise
en queue) : une tentative en ligne directe est déjà séquentielle et complète
avant la suivante, il n'y a pas de "mutation encore en attente plus loin"
qui pourrait résoudre la dépendance entre-temps.

**Purge des mutations synced** : `purgeSyncedMutations`
(`infrastructure/offline/mutation-queue.store.ts`) supprime les entrées
`synced: true` dont `syncedAt` dépasse une rétention de 7 jours
(`SYNCED_MUTATION_RETENTION_MS`) — assez pour investiguer un incident de
sync récent sans laisser `mutationQueue` croître indéfiniment. Déclenchée à
la fin de chaque cycle push+pull réussi (`network-status-store.ts:runSync`),
jamais sur un cycle en échec : une mutation non confirmée ou en erreur
(`syncError`) reste toujours intacte, seule `synced: true` est concernée.

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
exclusivement côté push (`sync-mutation.use-case.ts`), jamais côté pull —
décision assumée, pas un oubli de traçabilité. Ça tient parce que toute
donnée que le pull lit a déjà été écrite par un push : celui de CE client
(déjà réconcilié dans le même cycle, juste avant) ou celui d'un autre
appareil du même tenant (réconcilié et audité lors de SON propre push). Le
pull ne fait jamais que rafraîchir une valeur déjà tranchée, jamais
trancher lui-même un nouveau conflit.

Condition dont dépend cette garantie : elle suppose que **toute** écriture
sur une entity synchronisée passe par le `MutationHandler` enregistré pour
cette entity — jamais un accès direct au repository hors du moteur de sync
générique (import en masse, script d'admin, seed compris). Party la
respecte aujourd'hui : `createParty`/`updateParty`/`deleteParty` n'ont
qu'un seul appelant, `party-mutation-handler.ts` (voir
`presentation/party/actions.ts`, en lecture seule). Tout futur module
(Transaction inclus) doit préserver cette même invariante pour que
l'absence d'AuditLog au pull reste une garantie plutôt que de devenir un
angle mort silencieux.

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
d'IndexedDB plus agressive qu'Android après une période d'inactivité.
`infrastructure/offline/storage-persistence.ts` demande la persistance
(`navigator.storage.persist()`, best-effort, jamais garanti) — résout à
`false` sans lancer d'erreur sur un navigateur sans l'API. Le composant
`StoragePersistenceWarning` (`presentation/shared/components/`, monté dans
l'app shell) fait la demande une fois par montage et avertit l'utilisateur
uniquement en cas de refus confirmé (`isStoragePersisted()` après le refus
de `persist()`), fermeture mémorisée en sessionStorage comme la bannière
d'installation.

**Installation** : `apple-touch-icon`, `apple-mobile-web-app-title`,
`apple-mobile-web-app-status-bar-style` sont émis par la Metadata API de
Next.js (`appleWebApp` dans `src/app/layout.tsx`) — vérifié par inspection
du HTML rendu. Next.js 16 n'émet plus que `mobile-web-app-capable` (non
préfixé, standard récent, supporté depuis iOS 17.4) — l'historique
`apple-mobile-web-app-capable` qu'Apple documente encore pour les versions
antérieures n'est plus généré automatiquement, ajouté manuellement via
`metadata.other` dans le même fichier pour ne pas dépendre d'iOS 17.4+.

## Sécurité du cache local (IndexedDB)

Le cache offline (`localCache`, `mutationQueue` — voir
`infrastructure/offline/db.ts`) contient des données métier sensibles
(montants, coordonnées clients) directement lisibles depuis
IndexedDB sur l'appareil, potentiellement partagé (plusieurs vendeurs sur
le même téléphone boutique) ou volé. **Décision V1, assumée** : pas de
chiffrement du contenu IndexedDB lui-même — complexité et coût de
performance disproportionnés pour cette version, sur un device supposé
personnel dans l'usage nominal. La protection réelle repose sur le cycle
de vie du cache, pas sur son contenu :

- **Déconnexion** (`clearAccountCache`, appelé par
  `sidebar-nav-content.tsx` avant `signOutAction()`) : vide entièrement le
  cache et le marqueur de compte. Aucune donnée ne doit rester accessible
  après déconnexion sur un appareil partagé.
- **Changement de compte** (`ensureCacheMatchesAccount`, appelé au montage
  de `app-shell.tsx`) : si le compte actuellement connecté diffère du
  dernier marqueur connu (autre `tenantId`/`userId` sur ce même
  appareil/navigateur — ex: un vendeur qui se connecte après un autre sans
  déconnexion explicite préalable), le cache est vidé avant que le
  moindre enfant ne puisse le lire. L'ordre d'exécution des effets React
  (enfants avant parents) impose que ce garde-fou bloque le rendu de ses
  enfants jusqu'à sa propre résolution — sans ça, un composant descendant
  pourrait lire le cache de l'ancien compte avant que ce garde-fou n'ait eu
  la main.
- Le marqueur de compte lui-même vit en `localStorage` (synchrone), jamais
  IndexedDB : il doit être lisible sans attendre l'ouverture d'une
  connexion IndexedDB, avant tout accès potentiel au cache.

Si le chiffrement au repos devient nécessaire (device professionnel non
maîtrisé, exigence réglementaire), il resterait à ajouter une couche de
chiffrement symétrique dérivée d'un secret de session — non fait ici, piste
à documenter séparément le jour où le besoin se confirme.

## Session expirée pendant une synchronisation

`syncMutationAction`/`pullChangesAction` (`presentation/offline/actions.ts`)
retournent une enveloppe `SyncActionResult<T>` (`application/offline/sync-result.ts`) —
`{ ok: true; data: T } | { ok: false; reason: "auth_required" }` — plutôt
que de laisser échapper l'erreur d'authentification comme une exception
ordinaire. Raison : les classes d'erreur custom (`ForbiddenError`) ne
survivent pas à la sérialisation d'une Server Action, seul `message`
traverse la frontière réseau — un `catch (e) { if (e instanceof
ForbiddenError) }` côté client ne fonctionnerait donc jamais. Toute autre
erreur (validation, bug serveur, réseau) continue de rejeter normalement,
gérée par le backoff générique déjà en place.

`sync-engine.ts`/`pull-engine.ts` traduisent un `{ ok: false }` reçu en
`AuthRequiredError` (`infrastructure/offline/errors.ts`), levée plutôt que
retournée : rejoint ainsi l'idiome déjà utilisé partout ailleurs dans le
projet pour les erreurs typées (`instanceof`). Cette erreur n'est **jamais**
traitée comme un échec de mutation ordinaire — pas de backoff exponentiel,
pas de `retryCount` incrémenté, la mutation reste intacte en queue.
`network-status-store.ts` l'intercepte (push et pull) et redirige
immédiatement vers `/login` (`window.location.assign`, rechargement complet
— pas de routeur Next.js dans cette couche, volontairement agnostique) :
aucun code de "reprise" dédié n'est nécessaire, le prochain cycle de sync
déclenché après reconnexion retente la mutation restée en attente.

Le Route Handler `/api/sync` (service worker) signale la même situation
par un simple `401` HTTP plutôt que par cette enveloppe — pas de Server
Action à ce niveau, un code de statut suffit et le SW n'a de toute façon
aucun routeur vers lequel rediriger.

## Next.js 16 — particularité à connaître

Le middleware s'appelle désormais `proxy` (`src/proxy.ts`, plus
`middleware.ts` — un fichier `middleware.ts` orphelin serait silencieusement
ignoré). Il ne fait qu'une vérification optimiste (cookie de session présent
ou non) : l'autorisation réelle (tenantId, role) est toujours revérifiée côté
serveur dans chaque Server Action via `requireTenantContext()`.
