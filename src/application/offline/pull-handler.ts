import type { TenantContext } from "@/domain/shared/tenant-context";

/** Nombre d'enregistrements maximum retourné par page de pull — évite de
 * rapatrier des milliers de lignes d'un coup sur une connexion lente. */
export const PULL_PAGE_SIZE = 200;

/**
 * Enregistrement tel que renvoyé par le pull — `deletedAt` non nul signale
 * une suppression (soft delete) que le client doit retirer de son cache
 * local plutôt que garder affichée, jamais une ligne à ignorer.
 */
export type PulledRecord<TData = unknown> = {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  data: TData;
};

/**
 * Contrat que chaque module métier implémente pour brancher son entity sur
 * le pull générique (`registerPullHandler`, cf. pull-handler-registry.ts) —
 * symétrique à `MutationHandler` côté push. `queryStartedAt` est fourni par
 * le use case appelant (pull-changes.use-case.ts), jamais recalculé ici :
 * une seule capture d'horodatage par cycle de pull, partagée par toutes ses
 * pages, sert de borne haute stable à la requête.
 */
export interface PullHandler<TData = unknown> {
  findChangedSince(
    context: TenantContext,
    since: Date,
    queryStartedAt: Date,
    pageCursor?: string,
  ): Promise<{ records: PulledRecord<TData>[]; nextPageCursor?: string }>;
}
