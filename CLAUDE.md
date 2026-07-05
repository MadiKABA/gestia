@AGENTS.md

# Gestia — mémoire de contexte

Gestia remplace le cahier papier de dettes/créances/caisse des commerçants.
But du produit : le commerçant sait à tout moment **qui lui doit** de
l'argent, **à qui il doit**, et **combien il a réellement en caisse**.
Multi-tenant dès la V1, auth téléphone + PIN (terrain), offline-first complet
(PWA), theming par boutique dans une charte de plateforme cohérente.

Vocabulaire imposé dans toute l'UI et le code métier : "qui me doit" / "à qui
je dois" / "ma caisse" — jamais de jargon comptable (pas de "débiteur",
"grand livre", etc.). Devise par défaut : FCFA.

## Rôles

- **PATRON** : accès complet — tableau de bord, tiers, transactions, caisse,
  gestion des vendeurs, historiques, paramètres, theming.
- **VENDEUR** : créances/dettes, paiements, consultation de ses propres
  opérations. Jamais : trésorerie globale, suppression, gestion utilisateurs,
  theming.

## Authentification (téléphone + PIN)

- Inscription : téléphone → OTP SMS (Africa's Talking) → PIN à 4 chiffres.
- Connexion : téléphone + PIN (pas d'email/mot de passe en méthode principale
  — l'email reste un champ optionnel).
- Invitation vendeur : le patron ajoute un numéro ; le vendeur définit son PIN
  via le même flux OTP que la réinitialisation de PIN, à sa première connexion.
- Sécurité : PIN hashé Argon2, verrouillage après 5 tentatives échouées
  (`MAX_FAILED_ATTEMPTS`, `src/domain/auth/pin-policy.ts`), session expirée
  après inactivité.
- Intégration technique : better-auth gère uniquement la session (cookie,
  CSRF, expiration) — la vérification du PIN est un plugin custom
  (`src/infrastructure/auth/pin-auth.plugin.ts`) car `User.pinHash` vit sur le
  modèle User directement (schéma §6 ci-dessous), incompatible avec le modèle
  credential/account standard de better-auth. Aucun provider email/mot de
  passe ni OAuth activé. Détails d'implémentation : voir ARCHITECTURE.md.

## Theming

**Charte plateforme (fixe, jamais personnalisable)** : structure de l'UI,
typographie (Inter/IBM Plex Sans, chiffres en tabular figures), couleurs
sémantiques — vert `#1B7A5A` = réglé/succès, rouge `#C0392B` = retard/alerte,
jamais modifiables. Logo Gestia discret toujours visible (connexion, coin de
l'app), même en marque personnalisée.

**Personnalisable par tenant (V1)** : couleur principale parmi 6-8 presets
pré-validés contraste/accessibilité (jamais de color picker libre — reporté
V1.5), logo boutique (upload Cloudinary), nom affiché si différent du nom
légal. Stocké dans `TenantSettings.brandColor/logoUrl/displayName`.

## Modèle de données (référence — `prisma/schema.prisma`)

```
Tenant (boutique)
  ├── User (PATRON | VENDEUR — auth téléphone+PIN)
  ├── Party (clients/fournisseurs, type CLIENT|SUPPLIER|BOTH)
  │     └── Transaction (type CREANCE|DETTE, statut EN_COURS|PARTIELLE|REGLEE)
  │           └── Payment (règlement, method CASH|WAVE|ORANGE_MONEY|AUTRE)
  ├── CashMovement (ENTREE|SORTIE — manuel ou généré par un Payment CASH)
  ├── TenantSettings (devise, relance, theming — 1-1 avec Tenant)
  └── AuditLog (toute mutation métier — jamais de suppression définitive)
```

Tables additives non listées dans le cahier des charges mais requises par
l'infrastructure technique : `Session` (better-auth) et `OtpCode` (OTP
inscription/reset PIN). Ce sont des tables de plomberie, pas des entités
métier.

Règles non négociables sur ce schéma :

- Montants en `Decimal` (jamais `Float`), `quantity` reste `Float?`.
- Référence auto `CR-2026-XXXXX` (créance) / `DT-2026-XXXXX` (dette),
  unique par tenant (`@@unique([tenantId, reference])`).
- Index `tenantId` sur toutes les tables métier — condition de l'isolation.

## Scope V1 (ce qui doit exister)

Gestion multi-tenant (isolation stricte `tenantId`) · gestion utilisateurs
(patron crée/désactive des vendeurs) · tiers (CRUD, recherche nom+téléphone,
tri par solde décroissant) · créances et dettes (montant, échéance, référence
auto, solde temps réel) · paiements (partiel/total, déclenche un CashMovement
si CASH) · mouvements de caisse manuels · tableau de bord patron (solde
caisse, à recevoir, à payer, position nette, échéances à J/7j/30j avec code
couleur rouge/orange/vert) · relance WhatsApp (template configurable, lien
`wa.me` pré-rempli) · paramètres + theming tenant · AuditLog systématique ·
PWA offline complet avec queue de synchronisation et résolution de conflit
"dernier écrit gagne" tracée en AuditLog.

## Hors périmètre (ne pas implémenter avant la version indiquée)

| Version | Fonctionnalité                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| V1.5    | Pièces jointes (photo, signature), export PDF, thèmes avancés/color picker libre                                |
| V2      | Facturation formelle, gestion de stock (Produit/Catégorie), POS/scan code-barres                                |
| V2/V3   | Modèle Company distinct (NINEA, RCCM), auth email/mot de passe                                                  |
| V3      | RBAC configurable, multi-boutique par tenant, plans d'abonnement SaaS, comptabilité SYSCOHADA, rapports avancés |

## Exigences non-fonctionnelles clés

- Connexion < 5 s, ajout d'une transaction < 15 s.
- Mobile-first : un écran = une action.
- Isolation tenant centralisée et non contournable : voir
  `TenantScopedRepository` (ARCHITECTURE.md) — jamais de filtrage `tenantId`
  ad hoc dans une query.
- Sync offline : aucune transaction perdue même si l'app ferme avant sync ;
  toute divergence tracée en AuditLog, jamais écrasée silencieusement.
- Presets de couleur validés contraste/lisibilité uniquement — jamais de
  choix libre non contrôlé.

## Conventions de code

- Architecture en couches layer-first : `domain/` → `application/` →
  `infrastructure/` → `presentation/`, chacune subdivisée par feature. Détail
  complet, flux de requête et règles d'ajout de feature : voir
  ARCHITECTURE.md.
- Aucun accès Prisma hors `infrastructure/` (imposé par ESLint
  `no-restricted-imports`, voir `eslint.config.mjs`).
- Toute mutation métier passe par un use case qui écrit une entrée AuditLog
  (`AuditLogger`, `src/application/shared/audit-logger.ts`).
- `@typescript-eslint/no-explicit-any: error` — pas de `any`, typer
  explicitement ou utiliser `unknown` + garde de type.
- Conventional Commits, **types en anglais** (`feat`, `fix`, `chore`...),
  **description en français**, scope parmi la liste de
  `commitlint.config.mjs`. Jamais de mention Claude/IA ni de trailer
  `Co-Authored-By` dans les messages — tous les commits sont attribués à
  l'auteur humain uniquement.
- Un commit = un changement logique cohérent (jamais de commit fourre-tout).

## Stack (versions exactes — voir `package.json`)

Next.js 16 (App Router, Turbopack, TypeScript strict) · React 19 · Tailwind
v4 · shadcn/ui · Prisma 7 (driver adapter `@prisma/adapter-pg`, plus de moteur
Rust) · better-auth 1.6 · Argon2 · SMS Africa's Talking (client `fetch`
maison, pas le SDK npm — dépendances vulnérables, voir ARCHITECTURE.md) ·
Cloudinary · Serwist/`@serwist/turbopack` (PWA) · Vitest + Playwright ·
ESLint/Prettier/Husky/lint-staged/commitlint.

PostgreSQL tourne nativement en local (jamais via Docker en dev — Docker est
réservé au déploiement prod). Voir README.md pour l'installation.
