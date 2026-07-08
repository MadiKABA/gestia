import type {
  TransactionRepository,
  TransactionSearchQuery,
} from "@/application/transaction/transaction.repository";

export async function searchTransactions(
  deps: { repository: TransactionRepository },
  query: TransactionSearchQuery,
) {
  return deps.repository.findMany(query);
}
