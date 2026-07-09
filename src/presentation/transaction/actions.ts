"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { searchTransactions } from "@/application/transaction/search-transactions.use-case";
import { getTransactionById } from "@/application/transaction/get-transaction-by-id.use-case";
import { getTransactionBalanceSummary } from "@/application/transaction/get-transaction-balance-summary.use-case";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import {
  transactionSearchSchema,
  type TransactionSearchInput,
} from "@/presentation/transaction/schemas";

/**
 * Lecture seule : sert de source pour le rendu serveur initial et le
 * rafraîchissement en arrière-plan du cache local (voir
 * infrastructure/transaction/transaction-offline.repository.ts). Les
 * écritures ne passent jamais par une Server Action dédiée — même règle que
 * Party, voir presentation/party/actions.ts.
 */
export async function searchTransactionsAction(input: TransactionSearchInput = {}) {
  const context = await requireTenantContext();
  const repository = new PrismaTransactionRepository(context.tenantId);

  const query = transactionSearchSchema.parse(input);
  return searchTransactions({ repository }, query);
}

export async function getTransactionByIdAction(id: string) {
  const context = await requireTenantContext();
  const repository = new PrismaTransactionRepository(context.tenantId);
  const partyRepository = new PrismaPartyRepository(context.tenantId);

  return getTransactionById({ repository, partyRepository }, id);
}

/** Résumé "On me doit"/"Je dois" — consommé par la liste des opérations
 * (tous rôles, même accès que cette page aujourd'hui) et par le dashboard
 * patron (protégé par requirePatron() au niveau de la page, pas ici). */
export async function getTransactionBalanceSummaryAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTransactionRepository(context.tenantId);

  return getTransactionBalanceSummary({ repository });
}
