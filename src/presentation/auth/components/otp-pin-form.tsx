"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { OtpInput } from "@/presentation/shared/components/otp-input";
import { PinInput } from "@/presentation/shared/components/pin-input";
import { commonLabels } from "@/presentation/shared/labels";
import { OTP_LENGTH } from "@/domain/auth/otp";
import { PIN_LENGTH } from "@/domain/auth/pin-policy";

type Channel = "PHONE" | "EMAIL";

/** Écran "code + nouveau PIN" partagé par la réinitialisation de PIN et la
 * première connexion d'un vendeur invité (même use case confirmPinReset).
 * `channel` vient du choix fait à l'étape précédente (demande de code) — pas
 * de toggle ici, l'identifiant/canal est déjà fixé. */
export function OtpPinForm({
  initialIdentifier = "",
  channel = "PHONE",
  action,
  redirectTo,
  submitLabel,
}: {
  initialIdentifier?: string;
  channel?: Channel;
  action: (input: {
    channel: Channel;
    identifier: string;
    otp: string;
    newPin: string;
  }) => Promise<void>;
  redirectTo: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const newPinRef = useRef<HTMLInputElement>(null);

  function submit(newPinValue: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action({ channel, identifier, otp, newPin: newPinValue });
        router.push(redirectTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit(newPin);
  }

  const isFormValid =
    identifier.trim() !== "" && otp.length === OTP_LENGTH && newPin.length === PIN_LENGTH;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="identifier">
          {channel === "PHONE" ? "Numéro de téléphone" : "Adresse email"}
        </Label>
        {channel === "PHONE" ? (
          <PhoneInput
            id="identifier"
            value={identifier}
            onValueChange={setIdentifier}
            required
            autoFocus={!initialIdentifier}
          />
        ) : (
          <Input
            id="identifier"
            type="email"
            inputMode="email"
            value={identifier}
            onValueChange={setIdentifier}
            required
            autoFocus={!initialIdentifier}
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp">
          {channel === "PHONE" ? "Code reçu par SMS" : "Code reçu par email"}
        </Label>
        <OtpInput
          id="otp"
          value={otp}
          onValueChange={setOtp}
          onComplete={() => newPinRef.current?.focus()}
          autoFocus={Boolean(initialIdentifier)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPin">Nouveau code PIN</Label>
        <PinInput
          id="newPin"
          ref={newPinRef}
          value={newPin}
          onValueChange={setNewPin}
          onComplete={submit}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || !isFormValid}>
        {pending ? "Validation..." : submitLabel}
      </Button>
    </form>
  );
}
