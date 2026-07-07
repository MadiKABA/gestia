import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Message de mutation tel qu'envoyé par le moteur de sync
 * (infrastructure/offline/sync-engine.ts) au serveur. `entity` reste une
 * chaîne libre — ce fichier ne connaît aucun module métier (cahier des
 * charges §9 : le moteur de sync est générique).
 *
 * `clientKnownUpdatedAt` n'est PAS figé à l'écriture en queue : le moteur
 * de sync le relit depuis le cache local juste avant l'envoi de chaque
 * mutation. Sans ça, deux mutations en attente sur la même entité (le même
 * client modifie deux fois hors ligne avant la première sync) se
 * signaleraient un faux conflit l'une à l'autre, puisque le serveur assigne
 * un nouvel `updatedAt` à chaque écriture synchronisée.
 */
export type QueuedMutation<TPayload = unknown> = {
  id: string;
  tenantId: string;
  entity: string;
  action: "create" | "update" | "delete";
  payload: TPayload;
  clientGeneratedId: string;
  clientKnownUpdatedAt?: string;
  createdAt: string;
  createdById: string;
};

/**
 * Trace d'un écrasement "dernier écrit gagne" : valeur serveur remplacée et
 * son `updatedAt` au moment de l'écrasement. Écrite dans AuditLog par
 * `sync-mutation.use-case.ts`, jamais silencieusement perdue.
 */
export type ConflictInfo = {
  serverValueBeforeOverwrite: unknown;
  serverUpdatedAtBeforeOverwrite: string;
};

export type MutationHandlerResult = {
  updatedAt: string;
  conflict?: ConflictInfo;
};

/**
 * Contrat que chaque module métier implémente pour brancher son entity sur
 * le moteur de sync générique (`registerMutationHandler`, cf.
 * mutation-handler-registry.ts). `clientKnownUpdatedAt` est le dernier
 * `updatedAt` connu du client au moment de préparer sa mutation — absent
 * pour `create` (rien à comparer), obligatoire pour `update`/`delete` :
 * c'est la donnée qui permet la détection de conflit générique
 * (domain/offline/conflict.ts).
 */
export interface MutationHandler<TPayload = unknown> {
  create(
    context: TenantContext,
    clientGeneratedId: string,
    payload: TPayload,
  ): Promise<MutationHandlerResult>;
  update(
    context: TenantContext,
    id: string,
    payload: TPayload,
    clientKnownUpdatedAt: string,
  ): Promise<MutationHandlerResult>;
  delete(
    context: TenantContext,
    id: string,
    clientKnownUpdatedAt: string,
  ): Promise<MutationHandlerResult>;
}
