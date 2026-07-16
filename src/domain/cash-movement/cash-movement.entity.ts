import type { PaymentDirection, PaymentMethod } from "@/domain/payment/payment.entity";
import { ValidationError } from "@/domain/shared/errors";

export type CashMovementType = "ENTREE" | "SORTIE";

export type CashMovement = {
  id: string;
  tenantId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  linkedPaymentId: string | null;
  partyId: string | null;
  method: PaymentMethod | null;
  createdById: string;
  date: Date;
};

/**
 * Entrée manuelle uniquement (cahier des charges §7) : un mouvement issu
 * d'un paiement CASH est généré automatiquement par
 * register-payment.use-case.ts, jamais via ce type d'entrée — `reason` y est
 * imposé par `buildAutoReason`, jamais saisi. `partyId`/`method` restent
 * `null` pour un mouvement de caisse manuel classique — seule la vente au
 * comptant (`presentation/cash-movement/components/sale-create-form.tsx`)
 * les renseigne.
 */
export type CashMovementInput = {
  type: CashMovementType;
  amount: number;
  reason: string;
  partyId?: string | null;
  method?: PaymentMethod;
};

/**
 * Règles métier pures (cahier des charges §7) : montant strictement positif,
 * motif obligatoire — mêmes règles que validateTransactionInput/
 * validatePaymentAmount, jamais dupliquées différemment.
 */
export function validateCashMovementInput(input: CashMovementInput): void {
  if (!(input.amount > 0)) {
    throw new ValidationError("Le montant doit être supérieur à zéro");
  }
  if (!input.reason.trim()) {
    throw new ValidationError("Le motif est obligatoire");
  }
}

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
