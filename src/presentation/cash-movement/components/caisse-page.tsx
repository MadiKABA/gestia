"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import {
  seedCashMovementCache,
  seedOrReadCashBalanceCache,
} from "@/presentation/cash-movement/offline-repository";
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
 * dédié dans la nav, il vit ici). Le solde initial vient du rendu serveur
 * (`initialBalance`), mais n'est jamais affiché tel quel : `cashBalance`
 * (état local) est réconcilié au montage via `seedOrReadCashBalanceCache`
 * (presentation/cash-movement/offline-repository.ts), qui lit le cache
 * local patché en optimiste par CashMovementOfflineRepository à chaque
 * création — nécessaire pour un mouvement créé hors ligne juste avant la
 * redirection vers cette page : hors ligne, la redirection peut servir un
 * rendu serveur périmé via le cache du service worker (NetworkFirst, voir
 * sw.ts), qui ne connaît pas encore ce mouvement.
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
  const [cashBalance, setCashBalance] = useState(initialBalance);

  useEffect(() => {
    void seedCashMovementCache(tenantId, initialMovements);
  }, [tenantId, initialMovements]);

  useEffect(() => {
    void seedOrReadCashBalanceCache(tenantId, initialBalance).then(setCashBalance);
  }, [tenantId, initialBalance]);

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

  const balance = cashBalance.totalEntree - cashBalance.totalSortie;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-foreground text-lg font-semibold">{cashMovementLabels.listTitle}</h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/caisse/nouveau" />} nativeButton={false}>
            {cashMovementLabels.newButtonLabel}
          </Button>
          <Button render={<Link href="/ventes/new" />} nativeButton={false}>
            {cashMovementLabels.saleNewButtonLabel}
          </Button>
        </div>
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
            {cashBalance.totalEntree.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{cashMovementLabels.totalSortieLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#C0392B] tabular-nums">
            {cashBalance.totalSortie.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
      </div>

      {/* Mobile (< lg) : cards simples, design inchangé. */}
      {movements.length === 0 ? (
        <p className="text-muted-foreground text-sm lg:hidden">
          {cashMovementLabels.emptyStateList}
        </p>
      ) : (
        <ul className="space-y-2 lg:hidden">
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

      {/* Desktop/tablette (≥ lg) : tableau. Pas de colonne Actions : aucun
          use-case update/delete n'existe pour CashMovement. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">{cashMovementLabels.reasonField}</th>
              <th className="px-3 py-2 font-medium">{cashMovementLabels.amountColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{cashMovementLabels.dateColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-border border-b last:border-b-0">
                <td className="text-foreground px-3 py-2">{movement.reason}</td>
                <td
                  className={cn(
                    "px-3 py-2 whitespace-nowrap tabular-nums",
                    movement.type === "ENTREE" ? "text-[#1B7A5A]" : "text-[#C0392B]",
                  )}
                >
                  {movement.type === "ENTREE" ? "+" : "-"}
                  {movement.amount.toLocaleString("fr-FR")} FCFA
                </td>
                <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                  {movement.date.toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{cashMovementLabels.emptyStateList}</p>
        ) : null}
      </div>

      {hasMore ? (
        <Button variant="outline" className="w-full" disabled={loadingMore} onClick={loadMore}>
          {cashMovementLabels.showMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}
