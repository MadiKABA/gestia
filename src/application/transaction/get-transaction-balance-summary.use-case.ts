import type { TransactionRepository } from "@/application/transaction/transaction.repository";

export async function getTransactionBalanceSummary(deps: { repository: TransactionRepository }) {
  return deps.repository.getBalanceSummary();
}
