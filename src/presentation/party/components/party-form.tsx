"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { Switch } from "@/presentation/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { partyInputSchema, type PartyFormInput } from "@/presentation/party/schemas";

const TYPE_OPTIONS = [
  { value: "CLIENT", label: "Client" },
  { value: "SUPPLIER", label: "Fournisseur" },
  { value: "BOTH", label: "Client et fournisseur" },
] as const;

const DEFAULT_VALUES: PartyFormInput = {
  name: "",
  phone: "",
  whatsappNumber: "",
  type: "CLIENT",
  isCompany: false,
  companyName: "",
  contactName: "",
  note: "",
};

export function PartyForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<PartyFormInput>;
  /** Redirige lui-même vers la page détail (`redirect()` côté serveur, voir
   * createPartyAction/updatePartyAction) — ne résout donc jamais côté client. */
  onSubmit: (input: PartyFormInput) => Promise<void>;
  submitLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PartyFormInput>({
    resolver: zodResolver(partyInputSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
  });

  const isCompany = watch("isCompany");

  function submit(values: PartyFormInput) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await onSubmit(values);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Une erreur est survenue");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nom</Label>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              id="name"
              value={field.value}
              onValueChange={field.onChange}
              autoFocus
              aria-invalid={!!errors.name}
            />
          )}
        />
        {errors.name ? <p className="text-destructive text-sm">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id="phone"
              value={field.value ?? ""}
              onValueChange={field.onChange}
              className={errors.phone ? "[&_input]:border-destructive" : undefined}
            />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsappNumber">WhatsApp (si différent du téléphone)</Label>
        <Controller
          control={control}
          name="whatsappNumber"
          render={({ field }) => (
            <PhoneInput
              id="whatsappNumber"
              value={field.value ?? ""}
              onValueChange={field.onChange}
            />
          )}
        />
        {errors.phone ? (
          <p className="text-destructive text-sm">{errors.phone.message}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Un moyen de contact est requis : téléphone ou WhatsApp.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Choisir un type" />
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

      <div className="border-border flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="isCompany">Entreprise</Label>
          <p className="text-muted-foreground text-sm">
            Ce tiers est une société, pas un particulier
          </p>
        </div>
        <Controller
          control={control}
          name="isCompany"
          render={({ field }) => (
            <Switch
              id="isCompany"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked)}
            />
          )}
        />
      </div>

      {isCompany ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Nom de la société (recommandé)</Label>
            <Controller
              control={control}
              name="companyName"
              render={({ field }) => (
                <Input id="companyName" value={field.value ?? ""} onValueChange={field.onChange} />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Nom du contact</Label>
            <Controller
              control={control}
              name="contactName"
              render={({ field }) => (
                <Input id="contactName" value={field.value ?? ""} onValueChange={field.onChange} />
              )}
            />
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="note">Note (optionnel)</Label>
        <Textarea id="note" {...register("note")} />
      </div>

      {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enregistrement..." : submitLabel}
      </Button>
    </form>
  );
}
