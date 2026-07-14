"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/presentation/shared/components/ui/button";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import {
  createTransactionOfflineRepository,
  seedTransactionCache,
} from "@/presentation/transaction/offline-repository";
import { PaymentModal } from "@/presentation/payment/components/payment-modal";
import { PaymentHistory } from "@/presentation/payment/components/payment-history";
import { seedPaymentCache } from "@/presentation/payment/offline-repository";
import {
  WhatsappLink,
  resolveWhatsappNumber,
} from "@/presentation/shared/components/whatsapp-link";
import { WhatsappReceiptLink } from "@/presentation/payment/components/whatsapp-receipt-link";
import { Badge } from "@/presentation/shared/components/ui/badge";
import {
  commonLabels,
  paymentLabels,
  transactionLabels,
  syncLabels,
} from "@/presentation/shared/labels";
import { isEligibleForReminder, type Transaction } from "@/domain/transaction/transaction.entity";
import type { Payment } from "@/domain/payment/payment.entity";

type PartyContact = { name: string; phone: string | null; whatsappNumber: string | null };

const TYPE_LABELS: Record<Transaction["type"], string> = {
  CREANCE: transactionLabels.typeCreance,
  DETTE: transactionLabels.typeDette,
};

const STATUS_LABEL: Record<Transaction["status"], string> = {
  EN_COURS: transactionLabels.statusEnCours,
  PARTIELLE: transactionLabels.statusPartielle,
  REGLEE: transactionLabels.statusReglee,
};

export function TransactionDetail({
  transaction: initialTransaction,
  party,
  whatsappTemplate,
  whatsappReceiptTemplates,
  boutique,
  reminderDays,
  tenantId,
  userId,
  canDelete,
  initialPayments,
}: {
  transaction: Transaction;
  party: PartyContact | null;
  whatsappTemplate: string | null;
  whatsappReceiptTemplates: { partial: string | null; final: string | null };
  /** Nom affiché à insérer dans les messages WhatsApp — voir
   * `TenantBranding.displayName ?? tenantName`. */
  boutique: string;
  /** `TenantSettings.reminderDays` — sert uniquement au badge "à relancer". */
  reminderDays: number;
  tenantId: string;
  userId: string;
  canDelete: boolean;
  initialPayments: Payment[];
}) {
  const router = useRouter();
  const [transaction, setTransaction] = useState(initialTransaction);
  const [payments, setPayments] = useState(initialPayments);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    void seedTransactionCache(tenantId, [transaction]);
  }, [tenantId, transaction]);

  useEffect(() => {
    void seedPaymentCache(tenantId, initialPayments);
  }, [tenantId, initialPayments]);

  async function onPaymentSuccess(payment: Payment) {
    setPayments((current) => [...current, payment]);
    setLastPayment(payment);
    const repository = createTransactionOfflineRepository(tenantId, userId);
    const updated = await repository.getById(transaction.id);
    if (updated) setTransaction(updated);
    router.refresh();
  }

  function onDelete() {
    setError(null);
    startDelete(async () => {
      try {
        const repository = createTransactionOfflineRepository(tenantId, userId);
        await repository.delete(transaction.id);
        router.push("/transactions");
      } catch (err) {
        setConfirmOpen(false);
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  const signedAmount = transaction.type === "CREANCE" ? transaction.amount : -transaction.amount;
  const amountColorClass = transaction.type === "CREANCE" ? "text-[#1B7A5A]" : "text-[#0F2A4A]";
  const whatsappNumber = resolveWhatsappNumber(party?.phone, party?.whatsappNumber);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-2xl">
      <div className="bg-card border-border flex items-start justify-between rounded-xl border p-4 shadow-xs">
        <div>
          <h1 className="text-foreground text-lg font-semibold">{transaction.description}</h1>
          <p className="text-muted-foreground text-sm">
            {TYPE_LABELS[transaction.type]} · {party?.name ?? "—"}
          </p>
        </div>
        <span className={`text-sm font-medium tabular-nums ${amountColorClass}`}>
          {signedAmount.toLocaleString("fr-FR")} FCFA
        </span>
      </div>

      <div className="bg-card border-border space-y-2 rounded-xl border p-4 text-sm shadow-xs">
        <p>
          <span className="text-muted-foreground">{transactionLabels.referenceLabel} : </span>
          {transaction.reference ?? syncLabels.syncing}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{transactionLabels.statusLabel} : </span>
          <span className={transaction.status === "REGLEE" ? "text-[#1B7A5A]" : undefined}>
            {STATUS_LABEL[transaction.status]}
          </span>
          {isEligibleForReminder(transaction, reminderDays) ? (
            <Badge variant="warning">{transactionLabels.reminderBadgeLabel}</Badge>
          ) : null}
        </p>
        {transaction.quantity != null ? (
          <p>
            <span className="text-muted-foreground">{transactionLabels.quantityLabel} : </span>
            {transaction.quantity}
          </p>
        ) : null}
        {transaction.dueDate ? (
          <p>
            <span className="text-muted-foreground">{transactionLabels.dueDateLabel} : </span>
            {transaction.dueDate.toLocaleDateString("fr-FR")}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {transaction.status !== "REGLEE" ? (
        <Button className="w-full" onClick={() => setPaymentOpen(true)}>
          {paymentLabels.payButtonLabel(transaction.type)}
        </Button>
      ) : null}

      {payments.length > 1 ? <PaymentHistory payments={payments} /> : null}

      {transaction.status !== "REGLEE" && transaction.type === "CREANCE" && whatsappNumber ? (
        <WhatsappLink
          phone={whatsappNumber}
          template={whatsappTemplate}
          client={party?.name ?? ""}
          amount={transaction.amount - transaction.paidAmount}
          totalAmount={transaction.amount}
          reference={transaction.reference}
          boutique={boutique}
          description={transaction.description}
          date={transaction.createdAt}
        />
      ) : null}

      {lastPayment &&
      transaction.type === "CREANCE" &&
      transaction.status !== "EN_COURS" &&
      whatsappNumber ? (
        <WhatsappReceiptLink
          phone={whatsappNumber}
          status={transaction.status}
          client={party?.name ?? ""}
          amountPaid={lastPayment.amount}
          method={lastPayment.method}
          remainingBalance={transaction.amount - transaction.paidAmount}
          totalAmount={transaction.amount}
          boutique={boutique}
          date={transaction.createdAt}
          partialTemplate={whatsappReceiptTemplates.partial}
          finalTemplate={whatsappReceiptTemplates.final}
        />
      ) : null}

      <div className="flex gap-2">
        {transaction.paidAmount > 0 ? (
          <Button
            variant="outline"
            className="flex-1"
            disabled
            title={paymentLabels.editDisabledTooltip}
          >
            {transactionLabels.editButtonLabel}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href={`/transactions/${transaction.id}/modifier`} />}
            nativeButton={false}
          >
            {transactionLabels.editButtonLabel}
          </Button>
        )}
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

      <PaymentModal
        transaction={transaction}
        tenantId={tenantId}
        userId={userId}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={(payment) => void onPaymentSuccess(payment)}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={transactionLabels.deleteConfirmTitle(
          transaction.reference ?? transaction.description,
        )}
        description={transactionLabels.deleteConfirmDescription}
        pending={deleting}
        onConfirm={onDelete}
      />
    </div>
  );
}
