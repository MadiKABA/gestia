"use client";

import { useState } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { createPaymentOfflineRepository } from "@/presentation/payment/offline-repository";
import { PAYMENT_METHOD_LABEL } from "@/presentation/payment/components/payment-method-labels";
import { paymentLabels, transactionLabels } from "@/presentation/shared/labels";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import type { Payment, PaymentMethod } from "@/domain/payment/payment.entity";
import type { Transaction } from "@/domain/transaction/transaction.entity";

/**
 * Modale de paiement partagée par la liste (action directe desktop/tablette)
 * et le détail (bouton Payer) — rendue dans un ResponsivePanel, contrairement
 * à la page de création qui n'en utilise plus (cf. plan de refonte). Montant
 * pré-rempli au solde restant, modifiable pour un paiement partiel.
 */
export function PaymentModal({
  transaction,
  tenantId,
  userId,
  open,
  onOpenChange,
  onSuccess,
}: {
  transaction: Transaction;
  tenantId: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (payment: Payment) => void;
}) {
  const remainingBalance = transaction.amount - transaction.paidAmount;
  const [amount, setAmount] = useState(remainingBalance);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * `transaction-detail.tsx` garde cette modale montée en continu (seul
   * `open` bascule sa visibilité) — sans ceci, `amount` resterait figé au
   * solde restant du tout premier montage : un deuxième paiement rouvrirait
   * la modale avec un montant obsolète. Ajustement pendant le rendu plutôt
   * qu'un `useEffect`, pour éviter un flash de l'ancienne valeur à l'ouverture.
   */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount(remainingBalance);
      setMethod("CASH");
      setError(null);
    }
  }

  const title = paymentLabels.payButtonLabel(transaction.type);
  const isFormValid = amount > 0 && amount <= remainingBalance;

  async function onSubmit() {
    if (!(amount > 0)) {
      setError(paymentLabels.amountInvalidError);
      return;
    }
    if (amount > remainingBalance) {
      setError(paymentLabels.amountExceedsRemainingError);
      return;
    }
    setError(null);
    setPending(true);
    let wasQueuedOffline = false;
    try {
      const repository = createPaymentOfflineRepository(tenantId, userId, () => {
        wasQueuedOffline = true;
      });
      const payment = await repository.create({ transactionId: transaction.id, amount, method });
      if (wasQueuedOffline) {
        toastQueuedOffline();
      } else {
        toastSuccess(paymentLabels.createdToastMessage);
      }
      onOpenChange(false);
      onSuccess(payment);
    } catch (err) {
      toastError(resolveErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">{transactionLabels.amountField}</Label>
          <Input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            min={0}
            max={remainingBalance}
            value={amount === 0 ? "" : String(amount)}
            onValueChange={(value) => setAmount(value === "" ? 0 : Number(value))}
            autoFocus
          />
          <p className="text-muted-foreground text-xs">
            {paymentLabels.amountRemainingHint(remainingBalance)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment-method">{paymentLabels.methodField}</Label>
          <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
            <SelectTrigger id="payment-method" className="w-full">
              <SelectValue>
                {(value: string) => PAYMENT_METHOD_LABEL[value as PaymentMethod]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">{paymentLabels.methodCash}</SelectItem>
              <SelectItem value="WAVE">{paymentLabels.methodWave}</SelectItem>
              <SelectItem value="ORANGE_MONEY">{paymentLabels.methodOrangeMoney}</SelectItem>
              <SelectItem value="AUTRE">{paymentLabels.methodOther}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button
          className="w-full"
          disabled={pending || !isFormValid}
          onClick={() => void onSubmit()}
        >
          {title}
        </Button>
      </div>
    </ResponsivePanel>
  );
}
