"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { listPaymentsByTransaction } from "@/application/payment/list-payments-by-transaction.use-case";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";

/**
 * Lecture seule : source du rendu serveur initial de l'historique des
 * paiements — même règle que searchTransactionsAction, les écritures ne
 * passent jamais par une Server Action (voir presentation/payment/offline-repository.ts).
 */
export async function listPaymentsByTransactionAction(transactionId: string) {
  const context = await requireTenantContext();
  const paymentRepository = new PrismaPaymentRepository(context.tenantId);

  return listPaymentsByTransaction({ paymentRepository }, transactionId);
}
