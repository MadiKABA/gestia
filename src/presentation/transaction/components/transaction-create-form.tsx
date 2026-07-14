"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import {
  PartyPickerStep,
  type PickedParty,
} from "@/presentation/transaction/components/party-picker-step";
import { createTransactionOfflineRepository } from "@/presentation/transaction/offline-repository";
import { BackLink } from "@/presentation/shared/components/back-link";
import { commonLabels, transactionLabels } from "@/presentation/shared/labels";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/domain/transaction/transaction.entity";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

/**
 * Page de création unique — remplace le wizard modal pour ce parcours (cf.
 * plan de refonte du module Transaction) : tous les champs visibles d'un
 * coup, dans l'ordre imposé (situation → tiers filtré selon la situation →
 * description → montant → échéance optionnelle), avec un bouton
 * "Enregistrer" en bas de page qui redirige vers la liste. Le wizard modal
 * (transaction-wizard.tsx) reste inchangé pour le bouton mobile "+" et les
 * raccourcis de la fiche client (party-detail.tsx) : ce composant ne le
 * remplace que pour le lien "Nouvelle opération" de la navigation
 * desktop/tablette (voir nav-config.ts).
 */
export function TransactionCreateForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const router = useRouter();

  const [type, setType] = useState<TransactionType>("CREANCE");
  const [party, setParty] = useState<PickedParty | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isFormValid = party !== null && description.trim() !== "" && amount > 0;

  function changeType(nextType: TransactionType) {
    if (nextType === type) return;
    setType(nextType);
    // Le tiers déjà choisi ne correspond plus forcément au bon type
    // (client/fournisseur) une fois la situation changée — jamais conservé
    // silencieusement, l'utilisateur doit resélectionner.
    setParty(null);
  }

  function submit() {
    setError(null);
    if (!party) {
      setError(transactionLabels.partyRequiredError);
      return;
    }
    if (!description.trim()) {
      setError(transactionLabels.descriptionRequiredError);
      return;
    }
    if (!(amount > 0)) {
      setError(transactionLabels.amountInvalidError);
      return;
    }
    startTransition(async () => {
      let wasQueuedOffline = false;
      try {
        const repository = createTransactionOfflineRepository(tenantId, userId, () => {
          wasQueuedOffline = true;
        });
        await repository.create({
          partyId: party.id,
          type,
          description: description.trim(),
          quantity: null,
          amount,
          dueDate: dueDate || null,
        });
        if (wasQueuedOffline) {
          toastQueuedOffline();
        } else {
          toastSuccess(transactionLabels.createdToastMessage);
        }
        router.push("/transactions");
      } catch (err) {
        toastError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-4xl">
      <BackLink href="/transactions" />
      <h1 className="text-foreground text-lg font-semibold">
        {type === "DETTE"
          ? transactionLabels.newPageTitleDette
          : transactionLabels.newPageTitleCreance}
      </h1>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label>{transactionLabels.situationQuestion}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={type === "CREANCE"}
                onClick={() => changeType("CREANCE")}
                className={cn(
                  "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                  type === "CREANCE"
                    ? "border-[#1B7A5A] bg-[#1B7A5A]/10 text-[#1B7A5A]"
                    : "border-border bg-card text-foreground",
                )}
              >
                {transactionLabels.owedToMeLabel}
              </button>
              <button
                type="button"
                aria-pressed={type === "DETTE"}
                onClick={() => changeType("DETTE")}
                className={cn(
                  "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                  type === "DETTE"
                    ? "border-[#0F2A4A] bg-[#0F2A4A]/10 text-[#0F2A4A]"
                    : "border-border bg-card text-foreground",
                )}
              >
                {transactionLabels.owedByMeLabel}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{transactionLabels.partyField}</Label>
            {party ? (
              <div className="bg-card border-border flex items-center justify-between rounded-lg border p-3">
                <span className="text-foreground text-sm font-medium">{party.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setParty(null)}>
                  {transactionLabels.backLabel}
                </Button>
              </div>
            ) : (
              <PartyPickerStep
                tenantId={tenantId}
                userId={userId}
                filterType={type === "CREANCE" ? "CLIENT" : "SUPPLIER"}
                onSelect={setParty}
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="create-description">{transactionLabels.descriptionField}</Label>
            <Input id="create-description" value={description} onValueChange={setDescription} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-amount">{transactionLabels.amountField}</Label>
            <Input
              id="create-amount"
              type="number"
              inputMode="decimal"
              min={0}
              value={amount === 0 ? "" : String(amount)}
              onValueChange={(value) => setAmount(value === "" ? 0 : Number(value))}
            />
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((increment) => (
                <Button
                  key={increment}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={transactionLabels.quickAmountAriaLabel(increment)}
                  onClick={() => setAmount((current) => current + increment)}
                >
                  +{increment.toLocaleString("fr-FR")}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-due-date">{transactionLabels.dueDateField}</Label>
            <Input id="create-due-date" type="date" value={dueDate} onValueChange={setDueDate} />
          </div>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button className="w-full" disabled={pending || !isFormValid} onClick={submit}>
        {transactionLabels.createSubmitLabel}
      </Button>
    </div>
  );
}
