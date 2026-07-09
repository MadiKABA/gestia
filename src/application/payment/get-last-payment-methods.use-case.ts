import type { PaymentMethod } from "@/domain/payment/payment.entity";
import type { PaymentRepository } from "@/application/payment/payment.repository";

/** Mode de paiement du dernier paiement de chaque transaction (colonne de
 * la liste unifiée créances/dettes) — voir
 * PrismaPaymentRepository.findLatestByTransactionIds. */
export async function getLastPaymentMethods(
  deps: { paymentRepository: PaymentRepository },
  transactionIds: string[],
): Promise<Map<string, PaymentMethod>> {
  const latest = await deps.paymentRepository.findLatestByTransactionIds(transactionIds);
  const methodByTransactionId = new Map<string, PaymentMethod>();
  for (const [transactionId, payment] of latest) {
    methodByTransactionId.set(transactionId, payment.method);
  }
  return methodByTransactionId;
}
