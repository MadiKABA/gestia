"use server";

import { requirePatron } from "@/presentation/auth/require-role";
import { listCashMovements } from "@/application/cash-movement/list-cash-movements.use-case";
import { getCashBalance } from "@/application/cash-movement/get-cash-balance.use-case";
import { PrismaCashMovementRepository } from "@/infrastructure/cash-movement/cash-movement.repository";
import type { CashMovementListQuery } from "@/application/cash-movement/cash-movement.repository";

/**
 * Lecture seule : sert de source pour le rendu serveur initial (première
 * page) et le "voir plus" de la page Caisse. Les écritures ne passent jamais
 * par une Server Action dédiée — même règle que Transaction/Payment, la
 * création passe uniquement par CashMovementOfflineRepository.
 */
export async function listCashMovementsAction(query: CashMovementListQuery) {
  const context = await requirePatron();
  const repository = new PrismaCashMovementRepository(context.tenantId);

  return listCashMovements(context, { repository }, query);
}

export async function getCashBalanceAction() {
  const context = await requirePatron();
  const repository = new PrismaCashMovementRepository(context.tenantId);

  return getCashBalance(context, { repository });
}
