import { ValidationError } from "@/domain/shared/errors";

export type TransactionType = "CREANCE" | "DETTE";
export type TransactionStatus = "EN_COURS" | "PARTIELLE" | "REGLEE";

export type Transaction = {
  id: string;
  tenantId: string;
  /** `null` tant que non synchronisé — générée server-side uniquement (voir
   * infrastructure/transaction/transaction.repository.ts, compteur Sequence
   * atomique par tenant/année), jamais côté client hors ligne. */
  reference: string | null;
  partyId: string;
  type: TransactionType;
  description: string;
  quantity: number | null;
  amount: number;
  paidAmount: number;
  dueDate: Date | null;
  status: TransactionStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionInput = {
  partyId: string;
  type: TransactionType;
  description: string;
  quantity?: number | null;
  amount: number;
  dueDate?: Date | string | null;
};

/** `partyId` reste immuable après création : une transaction ne change jamais de tiers. */
export type TransactionUpdateInput = Omit<TransactionInput, "partyId">;

/**
 * Règles métier pures (cahier des charges §8) : description obligatoire,
 * montant strictement positif, quantité (si renseignée) strictement
 * positive. `paidAmount`/`status`/`reference` ne sont jamais des entrées
 * utilisateur — dérivés ou générés ailleurs, jamais validés ici. Prend
 * `TransactionUpdateInput` (sans `partyId`, jamais utilisé par cette règle)
 * plutôt que `TransactionInput` : reste appelable tel quel en update, où
 * `partyId` est immuable et absent de l'input.
 */
export function validateTransactionInput(input: TransactionUpdateInput): void {
  if (!input.description.trim()) {
    throw new ValidationError("La description est obligatoire");
  }
  if (!(input.amount > 0)) {
    throw new ValidationError("Le montant doit être supérieur à zéro");
  }
  if (input.quantity != null && !(input.quantity > 0)) {
    throw new ValidationError("La quantité doit être supérieure à zéro");
  }
}

/**
 * Statut dérivé, jamais saisi par l'utilisateur (cahier des charges §8).
 * `paidAmount` reste toujours à 0 tant que le module Payment n'existe pas
 * (hors périmètre de ce retrofit) — cette fonction est déjà prête pour le
 * jour où `registerPayment` la réutilisera pour recalculer le statut.
 */
export function deriveTransactionStatus(amount: number, paidAmount: number): TransactionStatus {
  if (paidAmount <= 0) return "EN_COURS";
  if (paidAmount >= amount) return "REGLEE";
  return "PARTIELLE";
}

const REFERENCE_PREFIX: Record<TransactionType, string> = {
  CREANCE: "CR",
  DETTE: "DT",
};

/** Référence métier `CR-2026-00125` / `DT-2026-00045` — `counter` est déjà
 * l'incrément atomique par tenant/année (voir Sequence), jamais recalculé ici. */
export function formatReference(type: TransactionType, year: number, counter: number): string {
  return `${REFERENCE_PREFIX[type]}-${year}-${String(counter).padStart(5, "0")}`;
}

/**
 * Contribution signée d'une transaction au solde d'un tiers : une CREANCE
 * (le tiers me doit) compte positivement, une DETTE (je dois au tiers)
 * négativement — solde net du point de vue du commerçant (cahier des
 * charges §1, "qui me doit" / "à qui je dois"). Une transaction REGLEE
 * contribue naturellement 0 (amount - paidAmount = 0), pas besoin de
 * filtrer par statut en amont.
 */
export function transactionBalanceContribution(
  type: TransactionType,
  amount: number,
  paidAmount: number,
): number {
  const net = amount - paidAmount;
  // `-0` évité explicitement : une transaction soldée doit contribuer un
  // zéro strictement positif, jamais une négation qui produirait `-0`
  // (sans conséquence arithmétique, mais surprenante en test/debug).
  if (net === 0) return 0;
  return type === "CREANCE" ? net : -net;
}

/** Règle du signe appliquée une seule fois, réutilisée aussi bien pour le
 * solde agrégé en liste que pour le solde recalculé en détail — les deux
 * doivent toujours converger par construction. */
export function computePartyBalance(
  transactions: Pick<Transaction, "type" | "amount" | "paidAmount">[],
): number {
  return transactions.reduce(
    (total, t) => total + transactionBalanceContribution(t.type, t.amount, t.paidAmount),
    0,
  );
}
