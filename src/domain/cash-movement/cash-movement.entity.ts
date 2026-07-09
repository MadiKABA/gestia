import type { PaymentDirection } from "@/domain/payment/payment.entity";

export type CashMovementType = "ENTREE" | "SORTIE";

export type CashMovement = {
  id: string;
  tenantId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  linkedPaymentId: string | null;
  createdById: string;
  date: Date;
};

/**
 * Un paiement CASH encaissé (créance) fait entrer de l'argent en caisse ;
 * un paiement CASH remboursé (dette) en fait sortir — même règle de sens
 * que `derivePaymentDirection`, jamais recalculée indépendamment.
 */
export function deriveCashMovementTypeFromPaymentDirection(
  direction: PaymentDirection,
): CashMovementType {
  return direction === "IN" ? "ENTREE" : "SORTIE";
}

/** Motif généré automatiquement pour un mouvement de caisse issu d'un paiement — jamais saisi par l'utilisateur dans ce cas. */
export function buildAutoReason(transaction: {
  reference: string | null;
  description: string;
}): string {
  const label = transaction.reference ?? transaction.description;
  return `Paiement — ${label}`;
}
