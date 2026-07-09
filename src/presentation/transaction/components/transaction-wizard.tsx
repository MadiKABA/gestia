"use client";

import { useMemo, useState } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import {
  PartyPickerStep,
  type PickedParty,
} from "@/presentation/transaction/components/party-picker-step";
import { createTransactionOfflineRepository } from "@/presentation/transaction/offline-repository";
import { commonLabels, transactionLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/domain/transaction/transaction.entity";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

type Step = "person" | "amount" | "situation";

const STEP_TITLE: Record<Step, string> = {
  person: transactionLabels.stepPersonTitle,
  amount: transactionLabels.stepAmountTitle,
  situation: transactionLabels.stepSituationTitle,
};

/**
 * Parcours unifié de création d'une opération (créance/dette), en une seule
 * séquence : personne (tiers existant ou créé à la volée) → montant et
 * description → situation ("On me doit" / "Je dois"). Rendu dans un
 * ResponsivePanel par l'appelant (bottom sheet mobile / modale centrée
 * desktop) — ce composant ne connaît que son contenu, jamais son conteneur.
 *
 * `initialParty`/`initialType` permettent de sauter les étapes déjà connues
 * (ex: depuis la fiche Party, où le tiers et la situation sont déjà fixés
 * par le bouton cliqué) — jamais reposées dans ce cas.
 */
export function TransactionWizard({
  tenantId,
  userId,
  initialParty,
  initialType,
  onDone,
}: {
  tenantId: string;
  userId: string;
  initialParty?: PickedParty;
  initialType?: TransactionType;
  onDone: () => void;
}) {
  const repository = useMemo(
    () => createTransactionOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  const [party, setParty] = useState<PickedParty | null>(initialParty ?? null);
  const [step, setStep] = useState<Step>(initialParty ? "amount" : "person");
  const [type, setType] = useState<TransactionType | null>(initialType ?? null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handlePartySelected(picked: PickedParty) {
    setParty(picked);
    setStep("amount");
  }

  function handleAmountContinue() {
    if (!description.trim()) {
      setError(transactionLabels.descriptionRequiredError);
      return;
    }
    if (!(amount > 0)) {
      setError(transactionLabels.amountInvalidError);
      return;
    }
    setError(null);
    if (initialType) {
      void save(initialType);
      return;
    }
    setStep("situation");
  }

  async function save(finalType: TransactionType) {
    if (!party) return;
    setError(null);
    setPending(true);
    try {
      await repository.create({
        partyId: party.id,
        type: finalType,
        description: description.trim(),
        quantity: null,
        amount,
        dueDate: null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : commonLabels.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {STEP_TITLE[step]}
      </p>

      {step === "person" ? (
        <PartyPickerStep tenantId={tenantId} userId={userId} onSelect={handlePartySelected} />
      ) : null}

      {step === "amount" ? (
        <div className="space-y-4">
          {!initialParty ? (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("person")}>
              ← {transactionLabels.backLabel}
            </Button>
          ) : null}
          {party ? <p className="text-foreground text-sm font-medium">{party.name}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="wizard-amount">{transactionLabels.amountField}</Label>
            <Input
              id="wizard-amount"
              type="number"
              inputMode="decimal"
              min={0}
              value={amount === 0 ? "" : String(amount)}
              onValueChange={(value) => setAmount(value === "" ? 0 : Number(value))}
              autoFocus
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
            <Label htmlFor="wizard-description">{transactionLabels.descriptionField}</Label>
            <Input id="wizard-description" value={description} onValueChange={setDescription} />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button className="w-full" disabled={pending} onClick={handleAmountContinue}>
            {initialType ? transactionLabels.saveLabel : transactionLabels.continueLabel}
          </Button>
        </div>
      ) : null}

      {step === "situation" ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("amount")}>
            ← {transactionLabels.backLabel}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={type === "CREANCE"}
              onClick={() => setType("CREANCE")}
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
              onClick={() => setType("DETTE")}
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
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button
            className="w-full"
            disabled={pending || type === null}
            onClick={() => type && void save(type)}
          >
            {transactionLabels.saveLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
