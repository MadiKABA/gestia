"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { createCashMovementOfflineRepository } from "@/presentation/cash-movement/offline-repository";
import { commonLabels, cashMovementLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";
import type { CashMovementType } from "@/domain/cash-movement/cash-movement.entity";

/**
 * Page de création dédiée, pas de modale — même décision que
 * TransactionCreateForm (transaction-create-form.tsx) : tous les champs
 * visibles d'un coup, bouton "Enregistrer" en bas de page qui redirige vers
 * la liste (/caisse).
 */
export function CashMovementCreateForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const router = useRouter();
  const repository = useMemo(
    () => createCashMovementOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  const [type, setType] = useState<CashMovementType>("ENTREE");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!(amount > 0)) {
      setError(cashMovementLabels.amountInvalidError);
      return;
    }
    if (!reason.trim()) {
      setError(cashMovementLabels.reasonRequiredError);
      return;
    }
    startTransition(async () => {
      try {
        await repository.create({ type, amount, reason: reason.trim() });
        router.push("/caisse");
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4">
      <h1 className="text-foreground text-lg font-semibold">{cashMovementLabels.newPageTitle}</h1>

      <div className="space-y-1.5">
        <Label>{cashMovementLabels.typeField}</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={type === "ENTREE"}
            onClick={() => setType("ENTREE")}
            className={cn(
              "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
              type === "ENTREE"
                ? "border-[#1B7A5A] bg-[#1B7A5A]/10 text-[#1B7A5A]"
                : "border-border bg-card text-foreground",
            )}
          >
            {cashMovementLabels.typeEntree}
          </button>
          <button
            type="button"
            aria-pressed={type === "SORTIE"}
            onClick={() => setType("SORTIE")}
            className={cn(
              "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
              type === "SORTIE"
                ? "border-[#C0392B] bg-[#C0392B]/10 text-[#C0392B]"
                : "border-border bg-card text-foreground",
            )}
          >
            {cashMovementLabels.typeSortie}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cash-movement-amount">{cashMovementLabels.amountField}</Label>
        <Input
          id="cash-movement-amount"
          type="number"
          inputMode="decimal"
          min={0}
          value={amount === 0 ? "" : String(amount)}
          onValueChange={(value) => setAmount(value === "" ? 0 : Number(value))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cash-movement-reason">{cashMovementLabels.reasonField}</Label>
        <Input id="cash-movement-reason" value={reason} onValueChange={setReason} />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button className="w-full" disabled={pending} onClick={submit}>
        {cashMovementLabels.createSubmitLabel}
      </Button>
    </div>
  );
}
