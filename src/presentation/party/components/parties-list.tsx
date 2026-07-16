"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
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
import { formatAmount } from "@/presentation/shared/format-amount";
import type { CurrencyCode } from "@/config/currencies";

const TYPE_FILTERS = [
  { value: "ALL", label: partyLabels.filterAll },
  { value: "CLIENT", label: partyLabels.filterClient },
  { value: "SUPPLIER", label: partyLabels.filterSupplier },
  { value: "BOTH", label: partyLabels.typeBoth },
] as const;

const TYPE_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_FILTERS.map((option) => [option.value, option.label]),
);

/** Colonne "Type" du tableau desktop/tablette — wording singulier (une seule
 * ligne), contrairement aux libellés de filtre/compteur (pluriel). */
const TYPE_LABEL: Record<PartyType, string> = {
  CLIENT: partyLabels.typeClient,
  SUPPLIER: partyLabels.typeSupplier,
  BOTH: partyLabels.typeBoth,
};

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — voir PartyOfflineRepository. `initialParties` (rendu serveur)
 * ne sert qu'à amorcer le premier affichage et le cache local. */
export function PartiesList({
  initialParties,
  tenantId,
  userId,
  currency,
}: {
  initialParties: PartyWithBalance[];
  tenantId: string;
  userId: string;
  currency: CurrencyCode;
}) {
  const [parties, setParties] = useState(initialParties);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | PartyType>("ALL");
  const [, startTransition] = useTransition();
  const repository = useMemo(
    () => createPartyOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  // Répartition par type (résumé mobile/desktop) — même dimension que le
  // filtre TYPE_FILTERS ci-dessus, sur le modèle des compteurs par statut de
  // VendeursPanel. Reflète la liste déjà filtrée par la recherche/le
  // repository (pas un second calcul serveur).
  const counts = useMemo(() => {
    let client = 0;
    let supplier = 0;
    let both = 0;
    for (const party of parties) {
      if (party.type === "CLIENT") client++;
      else if (party.type === "SUPPLIER") supplier++;
      else both++;
    }
    return { total: parties.length, client, supplier, both };
  }, [parties]);

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
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-lg font-semibold">{partyLabels.listTitle}</h1>
        <Button render={<Link href="/tiers/nouveau" />} nativeButton={false} size="sm">
          {partyLabels.newButtonLabel}
        </Button>
      </div>

      {/* Mobile (< lg) : résumé 2 cases. */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.total}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.filterClient}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.client}</p>
        </div>
      </div>

      {/* Desktop/tablette (≥ lg) : résumé 4 cases. */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.total}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.filterClient}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.client}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.filterSupplier}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {counts.supplier}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{partyLabels.typeBoth}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.both}</p>
        </div>
      </div>

      <div className="flex gap-2 lg:max-w-md">
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

      {/* Mobile (< lg) : cards simples, design inchangé. */}
      <ul className="grid grid-cols-1 gap-2 lg:hidden">
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
                className="bg-card border-border hover:bg-accent flex h-full items-center justify-between rounded-lg border p-3 shadow-xs transition-colors"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">{party.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {party.phone ?? party.whatsappNumber}
                  </p>
                </div>
                <span className={`text-sm font-medium tabular-nums ${balanceColorClass}`}>
                  {formatAmount(party.balance, currency)}
                </span>
              </Link>
            </li>
          );
        })}
        {parties.length === 0 ? (
          <p className="text-muted-foreground text-sm">{partyLabels.emptyStateList}</p>
        ) : null}
      </ul>

      {/* Desktop/tablette (≥ lg) : tableau avec actions par ligne. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">{partyLabels.nameColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{partyLabels.phoneColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{partyLabels.typeColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{partyLabels.balanceColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{partyLabels.actionsColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => {
              const balanceColorClass =
                party.balance > 0
                  ? "text-[#1B7A5A]"
                  : party.balance < 0
                    ? "text-[#0F2A4A]"
                    : "text-foreground";
              return (
                <tr key={party.id} className="border-border border-b last:border-b-0">
                  <td className="text-foreground px-3 py-2">{party.name}</td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {party.phone ?? party.whatsappNumber}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {TYPE_LABEL[party.type]}
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${balanceColorClass}`}>
                    {formatAmount(party.balance, currency)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={partyLabels.viewActionLabel}
                        render={<Link href={`/tiers/${party.id}`} />}
                        nativeButton={false}
                      >
                        <Eye aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={partyLabels.editButtonLabel}
                        render={<Link href={`/tiers/${party.id}/modifier`} />}
                        nativeButton={false}
                      >
                        <Pencil aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {parties.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{partyLabels.emptyStateList}</p>
        ) : null}
      </div>
    </div>
  );
}
