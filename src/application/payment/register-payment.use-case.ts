import type { TenantContext } from "@/domain/shared/tenant-context";
import type { PaymentInput } from "@/domain/payment/payment.entity";
import { derivePaymentDirection, validatePaymentAmount } from "@/domain/payment/payment.entity";
import { deriveTransactionStatus } from "@/domain/transaction/transaction.entity";
import {
  buildAutoReason,
  deriveCashMovementTypeFromPaymentDirection,
} from "@/domain/cash-movement/cash-movement.entity";
import { DependencyNotFoundError } from "@/domain/shared/errors";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import type { PaymentRepository } from "@/application/payment/payment.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Ouvert à PATRON et VENDEUR — même règle d'accès que createTransaction
 * (cahier des charges §2 : le vendeur encaisse/rembourse au quotidien,
 * seule la suppression lui est refusée ailleurs dans ce module).
 */
export async function registerPayment(
  context: TenantContext,
  deps: {
    transactionRepository: TransactionRepository;
    paymentRepository: PaymentRepository;
    auditLogger: AuditLogger;
  },
  id: string,
  input: PaymentInput,
) {
  const transaction = await deps.transactionRepository.findById(input.transactionId);
  if (!transaction) {
    // Distinct d'un NotFoundError ordinaire : `transactionId` peut référencer
    // une Transaction créée hors ligne dans la même session, pas encore
    // synchronisée — voir DependencyNotFoundError et
    // infrastructure/offline/sync-engine.ts.
    throw new DependencyNotFoundError("Transaction", input.transactionId);
  }

  const remainingBalance = transaction.amount - transaction.paidAmount;
  validatePaymentAmount(input.amount, remainingBalance);

  const direction = derivePaymentDirection(transaction.type);
  const newPaidAmount = transaction.paidAmount + input.amount;
  const newStatus = deriveTransactionStatus(transaction.amount, newPaidAmount);
  const cashMovement =
    input.method === "CASH"
      ? {
          type: deriveCashMovementTypeFromPaymentDirection(direction),
          reason: buildAutoReason(transaction),
        }
      : null;

  const result = await deps.paymentRepository.register(
    id,
    {
      transactionId: input.transactionId,
      amount: input.amount,
      method: input.method,
      direction,
      note: input.note ?? null,
      newPaidAmount,
      newStatus,
      cashMovement,
    },
    context.userId,
  );

  await deps.auditLogger.log(context, {
    action: "payment.created",
    entity: "Payment",
    entityId: result.payment.id,
    newData: result.payment,
  });
  await deps.auditLogger.log(context, {
    action: "transaction.updated",
    entity: "Transaction",
    entityId: transaction.id,
    oldData: transaction,
    newData: result.transaction,
  });
  if (result.cashMovementId) {
    await deps.auditLogger.log(context, {
      action: "cash-movement.created",
      entity: "CashMovement",
      entityId: result.cashMovementId,
      newData: cashMovement,
    });
  }

  return result;
}
