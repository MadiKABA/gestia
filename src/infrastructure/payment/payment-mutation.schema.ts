import { z } from "zod";

/**
 * Schéma du payload de mutation Payment tel qu'il transite dans la queue de
 * sync — un seul schéma pour `create` (la seule action jamais enfilée pour
 * cette entity, voir payment-mutation-handler.ts). Le montant n'est validé
 * ici que structurellement (positif) : la règle "≤ solde restant" a besoin
 * de lire la Transaction, elle reste dans register-payment.use-case.ts.
 */
export const paymentSyncPayloadSchema = z.object({
  transactionId: z.string().trim().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "WAVE", "ORANGE_MONEY", "AUTRE"]),
  note: z.string().trim().min(1).nullable().optional(),
});
