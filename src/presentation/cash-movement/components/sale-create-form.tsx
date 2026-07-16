"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { BackLink } from "@/presentation/shared/components/back-link";
import {
  SaleClientPicker,
  type PickedSaleParty,
} from "@/presentation/cash-movement/components/sale-client-picker";
import { createCashMovementOfflineRepository } from "@/presentation/cash-movement/offline-repository";
import {
  PAYMENT_METHOD_ICON,
  PAYMENT_METHOD_LABEL,
} from "@/presentation/payment/components/payment-method-labels";
import { cashMovementLabels, paymentLabels, transactionLabels } from "@/presentation/shared/labels";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/domain/payment/payment.entity";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

// Modes de paiement proposés à la vente au comptant (maquette validée) —
// AUTRE reste réservé au paiement de créance/dette (payment-modal.tsx),
// jamais proposé ici.
const SALE_PAYMENT_METHODS: PaymentMethod[] = ["CASH", "WAVE", "ORANGE_MONEY"];

/**
 * Page de vente au comptant, dédiée (pas de modale/wizard) — même décision
 * que TransactionCreateForm/CashMovementCreateForm. Une vente reste, dans sa
 * nature, un CashMovement (entrée) : mêmes champs qu'un mouvement manuel,
 * plus un mode de paiement et un client optionnel.
 */
export function SaleCreateForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [party, setParty] = useState<PickedSaleParty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isFormValid = description.trim() !== "" && amount > 0;

  function submit() {
    setError(null);
    if (!description.trim()) {
      setError(cashMovementLabels.saleDescriptionRequiredError);
      return;
    }
    if (!(amount > 0)) {
      setError(cashMovementLabels.amountInvalidError);
      return;
    }
    startTransition(async () => {
      let wasQueuedOffline = false;
      try {
        const repository = createCashMovementOfflineRepository(tenantId, userId, () => {
          wasQueuedOffline = true;
        });
        await repository.create({
          type: "ENTREE",
          reason: description.trim(),
          amount,
          method,
          partyId: party?.id ?? null,
        });
        if (wasQueuedOffline) {
          toastQueuedOffline();
        } else {
          toastSuccess(cashMovementLabels.saleCreatedToastMessage);
        }
        router.push("/caisse");
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-4xl">
      <BackLink href="/caisse" />
      <h1 className="text-foreground text-lg font-semibold">
        {cashMovementLabels.saleNewPageTitle}
      </h1>

      <div className="space-y-1.5">
        <Label htmlFor="sale-description">{cashMovementLabels.saleDescriptionField}</Label>
        <Textarea
          id="sale-description"
          placeholder={cashMovementLabels.saleDescriptionPlaceholder}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <div className="space-y-1.5">
          <Label htmlFor="sale-amount">{cashMovementLabels.amountField}</Label>
          <Input
            id="sale-amount"
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
          <Label>{paymentLabels.methodField}</Label>
          <div className="grid grid-cols-3 gap-2">
            {SALE_PAYMENT_METHODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 text-center text-xs font-semibold transition-colors",
                  method === option
                    ? "border-[#1B7A5A] bg-[#1B7A5A]/10 text-[#1B7A5A]"
                    : "border-border bg-card text-foreground",
                )}
              >
                <span className="text-lg" aria-hidden>
                  {PAYMENT_METHOD_ICON[option]}
                </span>
                {PAYMENT_METHOD_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SaleClientPicker tenantId={tenantId} userId={userId} party={party} onSelect={setParty} />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button className="w-full" disabled={pending || !isFormValid} onClick={submit}>
        {cashMovementLabels.saleSubmitLabel}
      </Button>
    </div>
  );
}
