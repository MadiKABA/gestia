import { ValidationError } from "@/domain/shared/errors";
import type { TransactionType } from "@/domain/transaction/transaction.entity";

export type PaymentMethod = "CASH" | "WAVE" | "ORANGE_MONEY" | "AUTRE";
export type PaymentDirection = "IN" | "OUT";

export type Payment = {
  id: string;
  tenantId: string;
  transactionId: string;
  amount: number;
  method: PaymentMethod;
  direction: PaymentDirection;
  note: string | null;
  createdById: string;
  createdAt: Date;
};

export type PaymentInput = {
  transactionId: string;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
};

/**
 * Un paiement encaisse une créance (le tiers me paie, entrée d'argent) et
 * rembourse une dette (je paie le tiers, sortie d'argent) — le sens ne
 * dépend que du type de la transaction réglée, jamais saisi par l'utilisateur.
 */
export function derivePaymentDirection(type: TransactionType): PaymentDirection {
  return type === "CREANCE" ? "IN" : "OUT";
}

/**
 * Un paiement ne peut jamais dépasser le solde restant : au-delà, ce
 * n'est plus un paiement partiel/total mais une transaction distincte
 * (hors périmètre de cette règle).
 */
export function validatePaymentAmount(amount: number, remainingBalance: number): void {
  if (!(amount > 0)) {
    throw new ValidationError("Le montant doit être supérieur à zéro");
  }
  if (amount > remainingBalance) {
    throw new ValidationError("Le montant ne peut pas dépasser le solde restant");
  }
}
