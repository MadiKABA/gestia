import { z } from "zod";
import {
  validateTransactionInput,
  type TransactionInput,
} from "@/domain/transaction/transaction.entity";
import { ValidationError } from "@/domain/shared/errors";

/**
 * Schéma du payload de mutation Transaction tel qu'il transite dans la
 * queue de sync — un seul schéma pour `create` ET `update` (le moteur de
 * sync générique résout un schéma par entity, jamais par action, voir
 * sync-mutation.use-case.ts), donc `partyId` reste requis même si
 * transaction-mutation-handler.ts l'ignore silencieusement en `update`
 * (immuabilité appliquée côté serveur, pas ici).
 */
export const transactionSyncPayloadSchema = z
  .object({
    partyId: z.string().trim().min(1),
    type: z.enum(["CREANCE", "DETTE"]),
    // Plafonné (voir party-mutation.schema.ts pour le raisonnement complet).
    description: z.string().trim().min(1).max(1000),
    quantity: z.number().nullable().optional(),
    amount: z.number(),
    // Le formulaire envoie une date sans heure ("YYYY-MM-DD", <input
    // type="date">) — jamais un objet Date (le payload reste une chaîne de
    // bout en bout : IndexedDB puis réseau, voir transaction-offline.repository.ts).
    dueDate: z.union([z.iso.date(), z.iso.datetime(), z.null()]).optional(),
  })
  .superRefine((input, ctx) => {
    try {
      validateTransactionInput(input as TransactionInput);
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["amount"] });
      }
    }
  });
