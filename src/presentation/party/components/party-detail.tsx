"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { deletePartyAction } from "@/presentation/party/actions";
import type { Party } from "@/domain/party/party.entity";

const TYPE_LABELS: Record<Party["type"], string> = {
  CLIENT: "Client",
  SUPPLIER: "Fournisseur",
  BOTH: "Client et fournisseur",
};

export function PartyDetail({
  party,
  balance,
  canDelete,
}: {
  party: Party;
  balance: number;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function onDelete() {
    setError(null);
    startDelete(async () => {
      try {
        await deletePartyAction(party.id);
        router.push("/tiers");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      }
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-lg font-semibold">{party.name}</h1>
          <p className="text-muted-foreground text-sm">{TYPE_LABELS[party.type]}</p>
        </div>
        <span className="text-foreground text-sm font-medium tabular-nums">
          {balance.toLocaleString("fr-FR")} FCFA
        </span>
      </div>

      <div className="border-border space-y-2 rounded-xl border p-4 text-sm">
        {party.phone ? (
          <p>
            <span className="text-muted-foreground">Téléphone : </span>
            {party.phone}
          </p>
        ) : null}
        {party.whatsappNumber ? (
          <p>
            <span className="text-muted-foreground">WhatsApp : </span>
            {party.whatsappNumber}
          </p>
        ) : null}
        {party.isCompany ? (
          <>
            <p>
              <span className="text-muted-foreground">Société : </span>
              {party.companyName ?? "—"}
            </p>
            {party.contactName ? (
              <p>
                <span className="text-muted-foreground">Contact : </span>
                {party.contactName}
              </p>
            ) : null}
          </>
        ) : null}
        {party.note ? (
          <p>
            <span className="text-muted-foreground">Note : </span>
            {party.note}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-foreground mb-2 text-sm font-semibold">Historique des transactions</h2>
        <p className="text-muted-foreground text-sm">Aucune transaction pour ce tiers.</p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          render={<Link href={`/tiers/${party.id}/modifier`} />}
          nativeButton={false}
        >
          Modifier
        </Button>
        {canDelete ? (
          <Button variant="destructive" className="flex-1" disabled={deleting} onClick={onDelete}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
