"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import {
  createTransactionOfflineRepository,
  seedTransactionCache,
} from "@/presentation/transaction/offline-repository";
import { BalanceSummaryCards } from "@/presentation/transaction/components/balance-summary-cards";
import { PaymentModal } from "@/presentation/payment/components/payment-modal";
import type { Transaction, TransactionType } from "@/domain/transaction/transaction.entity";
import { paymentLabels, transactionLabels, syncLabels } from "@/presentation/shared/labels";

const TYPE_FILTERS = [
  { value: "ALL", label: transactionLabels.filterAll },
  { value: "CREANCE", label: transactionLabels.filterCreance },
  { value: "DETTE", label: transactionLabels.filterDette },
] as const;

const TYPE_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_FILTERS.map((option) => [option.value, option.label]),
);

const STATUS_LABEL: Record<Transaction["status"], string> = {
  EN_COURS: transactionLabels.statusEnCours,
  PARTIELLE: transactionLabels.statusPartielle,
  REGLEE: transactionLabels.statusReglee,
};

/** Nombre d'opérations affichées par page — jamais toute la liste d'un coup
 * (cahier des charges : éviter une liste surchargée à l'écran). */
const PAGE_SIZE = 20;

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — même pattern que PartiesList. `parties` sert uniquement à
 * afficher un nom lisible (Transaction ne dénormalise jamais le nom du
 * tiers, voir domain/transaction/transaction.entity.ts). */
export function TransactionsList({
  initialTransactions,
  tenantId,
  userId,
  parties,
  summary,
  initialType,
}: {
  initialTransactions: Transaction[];
  tenantId: string;
  userId: string;
  parties: { id: string; name: string }[];
  summary: { owedToMe: number; owedByMe: number };
  /** Filtre initial ("Créances"/"Dettes" du menu, voir nav-config.ts) — la
   * page a déjà rendu la liste filtrée côté serveur avec cette même valeur. */
  initialType?: TransactionType;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | TransactionType>(initialType ?? "ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [paymentTarget, setPaymentTarget] = useState<Transaction | null>(null);
  const [, startTransition] = useTransition();
  const repository = useMemo(
    () => createTransactionOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const partyNameById = useMemo(
    () => new Map(parties.map((party) => [party.id, party.name])),
    [parties],
  );

  // Même resynchronisation que PartiesList : le routeur peut réutiliser ce
  // composant sans le remonter après un redirect post-mutation.
  const [prevInitialTransactions, setPrevInitialTransactions] = useState(initialTransactions);
  if (initialTransactions !== prevInitialTransactions) {
    setPrevInitialTransactions(initialTransactions);
    setTransactions(initialTransactions);
  }

  useEffect(() => {
    void seedTransactionCache(tenantId, initialTransactions);
  }, [tenantId, initialTransactions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const results = await repository.list({
          search: search || undefined,
          type: type === "ALL" ? undefined : type,
        });
        setTransactions(results);
        setVisibleCount(PAGE_SIZE);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, type, repository]);

  const visibleTransactions = transactions.slice(0, visibleCount);

  async function refresh() {
    const results = await repository.list({
      search: search || undefined,
      type: type === "ALL" ? undefined : type,
    });
    setTransactions(results);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-5xl">
      <h1 className="text-foreground text-lg font-semibold">{transactionLabels.listTitle}</h1>

      <div className="grid grid-cols-2 gap-3 lg:max-w-md">
        <BalanceSummaryCards owedToMe={summary.owedToMe} owedByMe={summary.owedByMe} />
      </div>

      <div className="flex gap-2 lg:max-w-md">
        <Input
          placeholder="Rechercher par description"
          value={search}
          onValueChange={setSearch}
          className="flex-1"
        />
        <Select value={type} onValueChange={(value) => setType(value as "ALL" | TransactionType)}>
          <SelectTrigger className="w-32">
            <SelectValue>
              {(value: string) => TYPE_FILTER_LABEL_BY_VALUE[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {visibleTransactions.map((transaction) => {
          const signedAmount =
            transaction.type === "CREANCE" ? transaction.amount : -transaction.amount;
          const amountColorClass =
            transaction.type === "CREANCE" ? "text-[#1B7A5A]" : "text-[#0F2A4A]";
          return (
            <li
              key={transaction.id}
              className="bg-card border-border flex items-center gap-2 rounded-lg border p-3 shadow-xs"
            >
              <Link
                href={`/transactions/${transaction.id}`}
                className="hover:text-accent-foreground flex min-w-0 flex-1 items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {transaction.description}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {partyNameById.get(transaction.partyId) ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {transaction.reference ?? syncLabels.syncing} ·{" "}
                    <span
                      className={
                        transaction.status === "REGLEE" ? "text-[#1B7A5A]" : "text-muted-foreground"
                      }
                    >
                      {STATUS_LABEL[transaction.status]}
                    </span>
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-medium tabular-nums ${amountColorClass}`}>
                  {signedAmount.toLocaleString("fr-FR")} FCFA
                </span>
              </Link>

              {/* Actions directes desktop/tablette (cf. CLAUDE.md responsive
                  desktop) : mobile garde tap → détail uniquement, actions
                  secondaires dans le détail. */}
              <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                {transaction.paidAmount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title={paymentLabels.editDisabledTooltip}
                  >
                    {transactionLabels.editButtonLabel}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/transactions/${transaction.id}/modifier`} />}
                    nativeButton={false}
                  >
                    {transactionLabels.editButtonLabel}
                  </Button>
                )}
                {transaction.status !== "REGLEE" ? (
                  <Button size="sm" onClick={() => setPaymentTarget(transaction)}>
                    {paymentLabels.payButtonLabel(transaction.type)}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{transactionLabels.emptyStateList}</p>
        ) : null}
      </ul>

      {visibleCount < transactions.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {transactionLabels.showMoreLabel}
        </Button>
      ) : null}

      {paymentTarget ? (
        <PaymentModal
          transaction={paymentTarget}
          tenantId={tenantId}
          userId={userId}
          open={paymentTarget !== null}
          onOpenChange={(open) => setPaymentTarget(open ? paymentTarget : null)}
          onSuccess={() => {
            setPaymentTarget(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
