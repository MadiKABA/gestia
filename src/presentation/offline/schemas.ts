import { z } from "zod";

/**
 * Enveloppe d'entrée du pull générique — validée avant tout accès au
 * registre de handlers, même si la surface d'attaque est réduite (pas de
 * payload métier ici, juste des coordonnées de requête) : ne jamais faire
 * confiance à une chaîne venant du client sous prétexte qu'elle ne
 * "contient pas de données".
 */
export const pullChangesInputSchema = z.object({
  entity: z.string().trim().min(1),
  since: z.iso.datetime(),
  pageCursor: z.string().trim().min(1).optional(),
});

export type PullChangesInput = z.infer<typeof pullChangesInputSchema>;

/**
 * Enveloppe d'entrée du push générique — valide la structure de la mutation
 * (id/entity/action/clientGeneratedId/dates), jamais son `payload` métier
 * (chaque MutationHandler reste responsable de valider son propre payload
 * avec son schéma Zod, ex: partyInputSchema — pas le rôle du moteur
 * générique qui ne connaît aucune entity). `tenantId` est délibérément
 * absent d'ici : il n'est jamais lu depuis l'entrée cliente, voir
 * syncMutationAction/le Route Handler /api/sync.
 */
export const queuedMutationInputSchema = z.object({
  id: z.string().trim().min(1),
  entity: z.string().trim().min(1),
  action: z.enum(["create", "update", "delete"]),
  payload: z.unknown(),
  clientGeneratedId: z.string().trim().min(1),
  clientKnownUpdatedAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  createdById: z.string().trim().min(1),
});

export type QueuedMutationInput = z.infer<typeof queuedMutationInputSchema>;
