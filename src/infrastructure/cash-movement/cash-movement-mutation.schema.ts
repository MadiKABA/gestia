import { z } from "zod";

/**
 * Schéma du payload de mutation CashMovement tel qu'il transite dans la
 * queue de sync — un seul schéma pour `create` (la seule action jamais
 * enfilée pour cette entity, voir cash-movement-mutation-handler.ts). Règles
 * exprimables directement en Zod (même choix que paymentSyncPayloadSchema) :
 * pas besoin de repasser par validateCashMovementInput ici, contrairement à
 * transactionSyncPayloadSchema dont les règles sont multi-champs.
 */
export const cashMovementSyncPayloadSchema = z.object({
  type: z.enum(["ENTREE", "SORTIE"]),
  amount: z.number().positive(),
  // Plafonné (voir party-mutation.schema.ts pour le raisonnement complet).
  reason: z.string().trim().min(1).max(1000),
  // Vente au comptant uniquement — `null`/absent pour un mouvement manuel
  // classique (voir cash-movement.entity.ts).
  partyId: z.string().trim().min(1).nullable().optional(),
  method: z.enum(["CASH", "WAVE", "ORANGE_MONEY", "AUTRE"]).optional(),
});
