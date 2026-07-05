"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";

/** Écran "téléphone" partagé par l'inscription et la réinitialisation de PIN :
 * envoie un OTP puis passe à l'écran suivant avec le numéro en query. */
export function RequestOtpForm({
  action,
  nextPathBase,
  submitLabel,
}: {
  action: (input: { phone: string }) => Promise<void>;
  nextPathBase: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await action({ phone });
        router.push(`${nextPathBase}?phone=${encodeURIComponent(phone)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">Numéro de téléphone</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          placeholder="+221771234567"
          value={phone}
          onValueChange={setPhone}
          required
          autoFocus
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Envoi en cours..." : submitLabel}
      </Button>
    </form>
  );
}
