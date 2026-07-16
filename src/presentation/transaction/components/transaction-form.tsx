"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  transactionInputSchema,
  toTransactionInput,
  type TransactionFormInput,
} from "@/presentation/transaction/schemas";
import { transactionLabels } from "@/presentation/shared/labels";
import { createTransactionOfflineRepository } from "@/presentation/transaction/offline-repository";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import type { CurrencyCode } from "@/config/currencies";

const TYPE_OPTIONS = [
  { value: "CREANCE", label: transactionLabels.owedToMeLabel },
  { value: "DETTE", label: transactionLabels.owedByMeLabel },
] as const;

const TYPE_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const DEFAULT_VALUES: TransactionFormInput = {
  partyId: "",
  type: "CREANCE",
  description: "",
  quantity: null,
  amount: 0,
  dueDate: "",
};

/**
 * Édition uniquement — la création passe désormais par la page unique
 * dédiée (transaction-create-form.tsx, cf. plan de refonte), jamais par ce
 * formulaire. `partyId` est immuable après création (voir
 * domain/transaction/transaction.entity.ts), le sélecteur reste donc
 * toujours désactivé ici.
 */
export function TransactionForm({
  transactionId,
  tenantId,
  userId,
  parties,
  defaultValues,
  submitLabel,
  currency,
}: {
  transactionId: string;
  tenantId: string;
  userId: string;
  parties: { id: string; name: string }[];
  defaultValues?: Partial<TransactionFormInput>;
  submitLabel: string;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, isValid },
  } = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionInputSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
    mode: "onChange",
  });

  // Formulaire toujours pré-rempli (édition uniquement) — sans ce
  // déclenchement initial, `isValid` resterait à `false` tant qu'aucun champ
  // n'est touché, alors que les valeurs par défaut sont déjà valides.
  useEffect(() => {
    void trigger();
  }, [trigger]);

  function submit(values: TransactionFormInput) {
    startTransition(async () => {
      let wasQueuedOffline = false;
      try {
        const repository = createTransactionOfflineRepository(tenantId, userId, () => {
          wasQueuedOffline = true;
        });
        const input = toTransactionInput(values);
        await repository.update(transactionId, input);
        if (wasQueuedOffline) {
          toastQueuedOffline();
        } else {
          toastSuccess(transactionLabels.updatedToastMessage);
        }
        // Retour à la liste plutôt qu'à la page détail — même raison que
        // party-form.tsx : indisponible juste après une modification hors ligne.
        router.push("/transactions");
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="partyId">{transactionLabels.partyField}</Label>
        <Controller
          control={control}
          name="partyId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(value) => field.onChange(value)} disabled>
              <SelectTrigger id="partyId" className="w-full" aria-invalid={!!errors.partyId}>
                <SelectValue placeholder="Choisir un client">
                  {(value: string) => parties.find((party) => party.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.partyId ? (
          <p className="text-destructive text-sm">{errors.partyId.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type">{transactionLabels.situationQuestion}</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Choisir un type">
                  {(value: string) => TYPE_LABEL_BY_VALUE[value] ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{transactionLabels.descriptionField}</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Input
              id="description"
              value={field.value}
              onValueChange={field.onChange}
              autoFocus
              aria-invalid={!!errors.description}
            />
          )}
        />
        {errors.description ? (
          <p className="text-destructive text-sm">{errors.description.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">{transactionLabels.amountField(currency)}</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              value={field.value === 0 ? "" : String(field.value)}
              onValueChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
              aria-invalid={!!errors.amount}
            />
          )}
        />
        {errors.amount ? <p className="text-destructive text-sm">{errors.amount.message}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quantity">{transactionLabels.quantityField}</Label>
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <Input
              id="quantity"
              type="number"
              inputMode="decimal"
              min={0}
              value={field.value == null ? "" : String(field.value)}
              onValueChange={(value) => field.onChange(value === "" ? null : Number(value))}
            />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dueDate">{transactionLabels.dueDateField}</Label>
        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => (
            <Input id="dueDate" type="date" value={field.value} onValueChange={field.onChange} />
          )}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending || !isValid}>
        {pending ? "Enregistrement..." : submitLabel}
      </Button>
    </form>
  );
}
