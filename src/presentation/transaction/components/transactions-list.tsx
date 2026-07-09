"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/presentation/shared/components/ui/input";
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
import type { Transaction, TransactionType } from "@/domain/transaction/transaction.entity";
import { transactionLabels, syncLabels } from "@/presentation/shared/labels";

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

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — même pattern que PartiesList. `parties` sert uniquement à
 * afficher un nom lisible (Transaction ne dénormalise jamais le nom du
 * tiers, voir domain/transaction/transaction.entity.ts). */
export function TransactionsList({
  initialTransactions,
  tenantId,
  userId,
  parties,
}: {
  initialTransactions: Transaction[];
  tenantId: string;
  userId: string;
  parties: { id: string; name: string }[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | TransactionType>("ALL");
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
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, type, repository]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-foreground text-lg font-semibold">{transactionLabels.listTitle}</h1>

      <div className="flex gap-2">
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

      <ul className="space-y-2">
        {transactions.map((transaction) => {
          const signedAmount =
            transaction.type === "CREANCE" ? transaction.amount : -transaction.amount;
          const amountColorClass =
            transaction.type === "CREANCE" ? "text-[#1B7A5A]" : "text-[#0F2A4A]";
          return (
            <li key={transaction.id}>
              <Link
                href={`/transactions/${transaction.id}`}
                className="bg-card border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3 shadow-xs transition-colors"
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
            </li>
          );
        })}
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{transactionLabels.emptyStateList}</p>
        ) : null}
      </ul>
    </div>
  );
}
