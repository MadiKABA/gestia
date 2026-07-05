"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";

/** Écran "code + nouveau PIN" partagé par la réinitialisation de PIN et la
 * première connexion d'un vendeur invité (même use case confirmPinReset). */
export function OtpPinForm({
  initialPhone = "",
  action,
  redirectTo,
  submitLabel,
}: {
  initialPhone?: string;
  action: (input: { phone: string; otp: string; newPin: string }) => Promise<void>;
  redirectTo: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await action({ phone, otp, newPin });
        router.push(redirectTo);
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
          autoFocus={!initialPhone}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Code reçu par SMS</Label>
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onValueChange={setOtp}
          required
          autoFocus={Boolean(initialPhone)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPin">Nouveau code PIN</Label>
        <Input
          id="newPin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          value={newPin}
          onValueChange={setNewPin}
          required
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Validation..." : submitLabel}
      </Button>
    </form>
  );
}
