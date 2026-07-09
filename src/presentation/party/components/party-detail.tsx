"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { TransactionWizard } from "@/presentation/transaction/components/transaction-wizard";
import {
  createPartyOfflineRepository,
  seedPartyCache,
} from "@/presentation/party/offline-repository";
import {
  createTransactionOfflineRepository,
  seedTransactionCache,
} from "@/presentation/transaction/offline-repository";
import { commonLabels, partyLabels, transactionLabels } from "@/presentation/shared/labels";
import type { PartyWithBalance } from "@/application/party/party.repository";
import type { Transaction, TransactionType } from "@/domain/transaction/transaction.entity";

const TYPE_LABELS: Record<PartyWithBalance["type"], string> = {
  CLIENT: partyLabels.typeClient,
  SUPPLIER: partyLabels.typeSupplier,
  BOTH: partyLabels.typeBoth,
};

/** Nombre d'opérations affichées par page dans l'historique — jamais toute
 * la liste d'un coup (même règle que TransactionsList). */
const PAGE_SIZE = 10;

export function PartyDetail({
  party,
  transactions: initialTransactions,
  tenantId,
  userId,
  canDelete,
}: {
  party: PartyWithBalance;
  transactions: Transaction[];
  tenantId: string;
  userId: string;
  canDelete: boolean;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [wizardType, setWizardType] = useState<TransactionType | null>(null);
  const transactionRepository = useMemo(
    () => createTransactionOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  // Même règle que delete-party.use-case.ts (hasOpenTransactions) : dérivée
  // de la liste déjà chargée plutôt que d'une seconde requête d'agrégation —
  // reflète aussi bien l'historique initial (SSR) qu'une opération créée
  // depuis cette page (voir refreshTransactions).
  const hasOpenTransactions = transactions.some((t) => t.status !== "REGLEE");

  // Amorce le cache local avec les données serveur fraîches (SSR) — pour
  // qu'une prochaine visite hors ligne de ce tiers les retrouve déjà là.
  useEffect(() => {
    void seedPartyCache(tenantId, [party]);
  }, [tenantId, party]);

  useEffect(() => {
    void seedTransactionCache(tenantId, initialTransactions);
  }, [tenantId, initialTransactions]);

  // Relit le cache local après création d'une opération depuis cette page —
  // évite un aller-retour serveur (router.refresh) juste pour afficher une
  // écriture déjà connue localement (offline-first).
  async function refreshTransactions() {
    const results = await transactionRepository.list({ partyId: party.id });
    setTransactions(results);
  }

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

  const balanceColorClass =
    party.balance > 0 ? "text-[#1B7A5A]" : party.balance < 0 ? "text-[#0F2A4A]" : "text-foreground";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-5xl">
      {/* Desktop/tablette : résumé + actions dans une colonne fixe à gauche,
          historique dans la colonne principale — jamais une simple liste
          verticale identique au mobile (cf. CLAUDE.md responsive desktop). */}
      <div className="space-y-6 lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6">
          <div className="bg-card border-border flex items-start justify-between rounded-xl border p-4 shadow-xs">
            <div>
              <h1 className="text-foreground text-lg font-semibold">{party.name}</h1>
              <p className="text-muted-foreground text-sm">{TYPE_LABELS[party.type]}</p>
            </div>
            <span className={`text-sm font-medium tabular-nums ${balanceColorClass}`}>
              {party.balance.toLocaleString("fr-FR")} FCFA
            </span>
          </div>

          <div className="bg-card border-border space-y-2 rounded-xl border p-4 text-sm shadow-xs">
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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setWizardType("CREANCE")}>
              {transactionLabels.newCreanceButtonLabel}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setWizardType("DETTE")}>
              {transactionLabels.newDetteButtonLabel}
            </Button>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              render={<Link href={`/tiers/${party.id}/modifier`} />}
              nativeButton={false}
            >
              {partyLabels.editButtonLabel}
            </Button>
            {canDelete ? (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting || hasOpenTransactions}
                onClick={() => setConfirmOpen(true)}
              >
                {commonLabels.delete}
              </Button>
            ) : null}
          </div>
          {canDelete && hasOpenTransactions ? (
            <p className="text-muted-foreground text-sm">
              Ce client a des créances ou dettes non soldées : la suppression n&apos;est pas
              possible tant qu&apos;elles n&apos;ont pas été réglées.
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-foreground mb-2 text-sm font-semibold">{partyLabels.historyTitle}</h2>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{partyLabels.emptyStateTransactions}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {transactions.slice(0, visibleCount).map((transaction) => {
                const signedAmount =
                  transaction.type === "CREANCE" ? transaction.amount : -transaction.amount;
                const amountColorClass =
                  transaction.type === "CREANCE" ? "text-[#1B7A5A]" : "text-[#0F2A4A]";
                return (
                  <li key={transaction.id}>
                    <Link
                      href={`/transactions/${transaction.id}`}
                      className="bg-card border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3 text-sm shadow-xs transition-colors"
                    >
                      <span className="text-foreground truncate">{transaction.description}</span>
                      <span className={`shrink-0 font-medium tabular-nums ${amountColorClass}`}>
                        {signedAmount.toLocaleString("fr-FR")} FCFA
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {visibleCount < transactions.length ? (
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              {transactionLabels.showMoreLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <ResponsivePanel
        open={wizardType !== null}
        onOpenChange={(open) => setWizardType(open ? wizardType : null)}
        title={
          wizardType === "DETTE"
            ? transactionLabels.newPageTitleDette
            : transactionLabels.newPageTitleCreance
        }
      >
        {wizardType ? (
          <TransactionWizard
            tenantId={tenantId}
            userId={userId}
            initialParty={{ id: party.id, name: party.name }}
            initialType={wizardType}
            onDone={() => {
              setWizardType(null);
              void refreshTransactions();
              router.refresh();
            }}
          />
        ) : null}
      </ResponsivePanel>

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
