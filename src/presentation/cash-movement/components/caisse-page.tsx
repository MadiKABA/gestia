"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { seedCashMovementCache } from "@/presentation/cash-movement/offline-repository";
import { listCashMovementsAction } from "@/presentation/cash-movement/actions";
import { cashMovementLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";
import type { CashMovement } from "@/domain/cash-movement/cash-movement.entity";
import type { CashBalance } from "@/application/cash-movement/cash-movement.repository";

const PAGE_SIZE = 20;

/**
 * Page Caisse : solde en temps réel (entrée/sortie/net) + liste paginée des
 * mouvements + bouton "Nouveau mouvement" en tête de page (résolution du
 * point resté en suspens après la fusion du menu sidebar — pas de bouton
 * dédié dans la nav, il vit ici). Solde affiché tel que rendu par le serveur
 * à l'ouverture ; un mouvement fraîchement créé n'ajuste pas ce total en
 * optimiste ici (contrairement au patch de TransactionDetail), la page est
 * quittée après création (redirection vers /caisse, qui refait un rendu
 * serveur frais) — pas besoin de double mécanisme.
 */
export function CaissePage({
  tenantId,
  initialMovements,
  initialTotal,
  initialBalance,
}: {
  tenantId: string;
  initialMovements: CashMovement[];
  initialTotal: number;
  initialBalance: CashBalance;
}) {
  const [movements, setMovements] = useState(initialMovements);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMovements.length < initialTotal);
  const [loadingMore, startLoadMore] = useTransition();

  useEffect(() => {
    void seedCashMovementCache(tenantId, initialMovements);
  }, [tenantId, initialMovements]);

  function loadMore() {
    startLoadMore(async () => {
      const nextPage = page + 1;
      const result = await listCashMovementsAction({ page: nextPage, pageSize: PAGE_SIZE });
      setMovements((current) => [...current, ...result.items]);
      void seedCashMovementCache(tenantId, result.items);
      setPage(nextPage);
      setHasMore(result.hasMore);
    });
  }

  const balance = initialBalance.totalEntree - initialBalance.totalSortie;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-lg font-semibold">{cashMovementLabels.listTitle}</h1>
        <Button render={<Link href="/caisse/nouveau" />} nativeButton={false}>
          {cashMovementLabels.newButtonLabel}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{cashMovementLabels.balanceLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {balance.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{cashMovementLabels.totalEntreeLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#1B7A5A] tabular-nums">
            {initialBalance.totalEntree.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{cashMovementLabels.totalSortieLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#C0392B] tabular-nums">
            {initialBalance.totalSortie.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
      </div>

      {movements.length === 0 ? (
        <p className="text-muted-foreground text-sm">{cashMovementLabels.emptyStateList}</p>
      ) : (
        <ul className="space-y-2">
          {movements.map((movement) => (
            <li
              key={movement.id}
              className="bg-card border-border flex items-center justify-between rounded-xl border p-3"
            >
              <div>
                <p className="text-foreground text-sm font-medium">{movement.reason}</p>
                <p className="text-muted-foreground text-xs">
                  {movement.date.toLocaleDateString("fr-FR")}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  movement.type === "ENTREE" ? "text-[#1B7A5A]" : "text-[#C0392B]",
                )}
              >
                {movement.type === "ENTREE" ? "+" : "-"}
                {movement.amount.toLocaleString("fr-FR")} FCFA
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <Button variant="outline" className="w-full" disabled={loadingMore} onClick={loadMore}>
          {cashMovementLabels.showMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}
