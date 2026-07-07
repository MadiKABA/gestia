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
