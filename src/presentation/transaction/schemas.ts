import { z } from "zod";
import {
  validateTransactionInput,
  type TransactionInput,
} from "@/domain/transaction/transaction.entity";
import { ValidationError } from "@/domain/shared/errors";
import { transactionLabels } from "@/presentation/shared/labels";

/** Le formulaire délègue les règles de montant/description/quantité à
 * `validateTransactionInput` (domain) via `superRefine` — jamais de
 * duplication de la règle métier côté Zod. `partyId` transite toujours
 * (même en édition, où il est ignoré côté offline-repository) : voir
 * infrastructure/transaction/transaction-offline.repository.ts pour la
 * raison (payload de mutation à forme unique create/update). */
export const transactionInputSchema = z
  .object({
    partyId: z.string().trim().min(1, transactionLabels.partyRequiredError),
    type: z.enum(["CREANCE", "DETTE"]),
    description: z.string().trim().min(1, transactionLabels.descriptionRequiredError),
    quantity: z.number().nullable(),
    amount: z.number(),
    /** Chaîne ISO ou vide (contrôle React) — jamais `undefined`. */
    dueDate: z.string(),
  })
  .superRefine((input, ctx) => {
    try {
      validateTransactionInput({
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        amount: input.amount,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["amount"] });
      }
    }
  });

export type TransactionFormInput = z.infer<typeof transactionInputSchema>;

export function toTransactionInput(input: TransactionFormInput): TransactionInput {
  return {
    partyId: input.partyId,
    type: input.type,
    description: input.description,
    quantity: input.quantity,
    amount: input.amount,
    dueDate: input.dueDate || null,
  };
}

export const transactionSearchSchema = z.object({
  partyId: z.string().trim().optional(),
  type: z.enum(["CREANCE", "DETTE"]).optional(),
  status: z.enum(["EN_COURS", "PARTIELLE", "REGLEE"]).optional(),
  search: z.string().trim().optional(),
});
export type TransactionSearchInput = z.infer<typeof transactionSearchSchema>;
