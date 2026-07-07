"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import {
  createPartyOfflineRepository,
  seedPartyCache,
} from "@/presentation/party/offline-repository";
import { commonLabels, partyLabels } from "@/presentation/shared/labels";
import type { PartyWithBalance } from "@/application/party/party.repository";

const TYPE_LABELS: Record<PartyWithBalance["type"], string> = {
  CLIENT: partyLabels.typeClient,
  SUPPLIER: partyLabels.typeSupplier,
  BOTH: partyLabels.typeBoth,
};

export function PartyDetail({
  party,
  tenantId,
  userId,
  canDelete,
}: {
  party: PartyWithBalance;
  tenantId: string;
  userId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  // Amorce le cache local avec les données serveur fraîches (SSR) — pour
  // qu'une prochaine visite hors ligne de ce tiers les retrouve déjà là.
  useEffect(() => {
    void seedPartyCache(tenantId, [party]);
  }, [tenantId, party]);

  function onDelete() {
    setError(null);
    startDelete(async () => {
      try {
        const repository = createPartyOfflineRepository(tenantId, userId);
        await repository.delete(party.id);
        router.push("/tiers");
      } catch (err) {
        setConfirmOpen(false);
        setError(err instanceof Error ? err.message : commonLabels.genericError);
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
          {party.balance.toLocaleString("fr-FR")} FCFA
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
        <p className="text-muted-foreground text-sm">{partyLabels.emptyStateTransactions}</p>
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
          <Button
            variant="destructive"
            className="flex-1"
            disabled={deleting}
            onClick={() => setConfirmOpen(true)}
          >
            {commonLabels.delete}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={partyLabels.deleteConfirmTitle(party.name)}
        description={partyLabels.deleteConfirmDescription}
        pending={deleting}
        onConfirm={onDelete}
      />
    </div>
  );
}
