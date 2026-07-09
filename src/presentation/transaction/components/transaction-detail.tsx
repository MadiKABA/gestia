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
import { commonLabels, transactionLabels, syncLabels } from "@/presentation/shared/labels";
import type { Transaction } from "@/domain/transaction/transaction.entity";

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
  transaction,
  partyName,
  tenantId,
  userId,
  canDelete,
}: {
  transaction: Transaction;
  partyName: string | null;
  tenantId: string;
  userId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    void seedTransactionCache(tenantId, [transaction]);
  }, [tenantId, transaction]);

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

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-lg font-semibold">{transaction.description}</h1>
          <p className="text-muted-foreground text-sm">
            {TYPE_LABELS[transaction.type]} · {partyName ?? "—"}
          </p>
        </div>
        <span className="text-foreground text-sm font-medium tabular-nums">
          {signedAmount.toLocaleString("fr-FR")} FCFA
        </span>
      </div>

      <div className="border-border space-y-2 rounded-xl border p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Référence : </span>
          {transaction.reference ?? syncLabels.syncing}
        </p>
        <p>
          <span className="text-muted-foreground">Statut : </span>
          <span className={transaction.status === "REGLEE" ? "text-[#1B7A5A]" : undefined}>
            {STATUS_LABEL[transaction.status]}
          </span>
        </p>
        {transaction.quantity != null ? (
          <p>
            <span className="text-muted-foreground">Quantité : </span>
            {transaction.quantity}
          </p>
        ) : null}
        {transaction.dueDate ? (
          <p>
            <span className="text-muted-foreground">Échéance : </span>
            {transaction.dueDate.toLocaleDateString("fr-FR")}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          render={<Link href={`/transactions/${transaction.id}/modifier`} />}
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
