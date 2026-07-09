import type { PaymentRepository } from "@/application/payment/payment.repository";

/** Historique des paiements d'une transaction, ordre chronologique — voir
 * PrismaPaymentRepository.findByTransactionId. */
export async function listPaymentsByTransaction(
  deps: { paymentRepository: PaymentRepository },
  transactionId: string,
) {
  return deps.paymentRepository.findByTransactionId(transactionId);
}
