"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import {
  createPartyOfflineRepository,
  seedPartyCache,
} from "@/presentation/party/offline-repository";
import type { PartyType } from "@/domain/party/party.entity";
import type { PartyWithBalance } from "@/application/party/party.repository";
import { partyLabels } from "@/presentation/shared/labels";

const TYPE_FILTERS = [
  { value: "ALL", label: partyLabels.filterAll },
  { value: "CLIENT", label: partyLabels.filterClient },
  { value: "SUPPLIER", label: partyLabels.filterSupplier },
  { value: "BOTH", label: partyLabels.typeBoth },
] as const;

const TYPE_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_FILTERS.map((option) => [option.value, option.label]),
);

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — voir PartyOfflineRepository. `initialParties` (rendu serveur)
 * ne sert qu'à amorcer le premier affichage et le cache local. */
export function PartiesList({
  initialParties,
  tenantId,
  userId,
}: {
  initialParties: PartyWithBalance[];
  tenantId: string;
  userId: string;
}) {
  const [parties, setParties] = useState(initialParties);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | PartyType>("ALL");
  const [, startTransition] = useTransition();
  const repository = useMemo(
    () => createPartyOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  // Le routeur App Router peut réutiliser cette instance de composant en
  // revenant sur /tiers (redirect post-mutation) sans la remonter : sans cet
  // ajustement, `parties` resterait figé sur l'ancien `initialParties` du
  // premier montage et ne refléterait jamais une création/suppression.
  // Pattern recommandé par React pour resynchroniser un state dérivé d'une
  // prop sans passer par un effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [prevInitialParties, setPrevInitialParties] = useState(initialParties);
  if (initialParties !== prevInitialParties) {
    setPrevInitialParties(initialParties);
    setParties(initialParties);
  }

  // Amorce le cache local avec les données serveur fraîches (SSR) — pour
  // qu'une prochaine visite hors ligne les retrouve déjà là.
  useEffect(() => {
    void seedPartyCache(tenantId, initialParties);
  }, [tenantId, initialParties]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const results = await repository.list({
          search: search || undefined,
          type: type === "ALL" ? undefined : type,
        });
        setParties(results);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, type, repository]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-lg font-semibold">{partyLabels.listTitle}</h1>
        <Button render={<Link href="/tiers/nouveau" />} nativeButton={false} size="sm">
          {partyLabels.newButtonLabel}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Rechercher par nom ou téléphone"
          value={search}
          onValueChange={setSearch}
          className="flex-1"
        />
        <Select value={type} onValueChange={(value) => setType(value as "ALL" | PartyType)}>
          <SelectTrigger className="w-36">
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
        {parties.map((party) => {
          const balanceColorClass =
            party.balance > 0
              ? "text-[#1B7A5A]"
              : party.balance < 0
                ? "text-[#0F2A4A]"
                : "text-foreground";
          return (
            <li key={party.id}>
              <Link
                href={`/tiers/${party.id}`}
                className="bg-card border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3 shadow-xs transition-colors"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">{party.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {party.phone ?? party.whatsappNumber}
                  </p>
                </div>
                <span className={`text-sm font-medium tabular-nums ${balanceColorClass}`}>
                  {party.balance.toLocaleString("fr-FR")} FCFA
                </span>
              </Link>
            </li>
          );
        })}
        {parties.length === 0 ? (
          <p className="text-muted-foreground text-sm">{partyLabels.emptyStateList}</p>
        ) : null}
      </ul>
    </div>
  );
}
