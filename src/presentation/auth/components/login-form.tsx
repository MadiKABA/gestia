"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { PinInput } from "@/presentation/shared/components/pin-input";
import { IdentifierToggle } from "@/presentation/auth/components/identifier-toggle";
import { commonLabels } from "@/presentation/shared/labels";
import { PIN_LENGTH } from "@/domain/auth/pin-policy";
import type { LocaleCountryCode } from "@/domain/shared/locale-country";

type Channel = "PHONE" | "EMAIL";

export function LoginForm({
  action,
  defaultCountryCode,
}: {
  action: (input: { channel: Channel; identifier: string; pin: string }) => Promise<void>;
  /** Indicatif pré-sélectionné (détection Accept-Language, voir
   * app/(auth)/login/page.tsx) — transmis tel quel à `PhoneInput`. */
  defaultCountryCode?: LocaleCountryCode;
}) {
  const [channel, setChannel] = useState<Channel>("PHONE");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChannelChange(next: Channel) {
    setChannel(next);
    setIdentifier("");
  }

  function submit(pinValue: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action({ channel, identifier, pin: pinValue });
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit(pin);
  }

  const isFormValid = identifier.trim() !== "" && pin.length === PIN_LENGTH;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <IdentifierToggle value={channel} onChange={onChannelChange} />
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
            autoFocus
            defaultCountryCode={defaultCountryCode}
          />
        ) : (
          <Input
            id="identifier"
            type="email"
            inputMode="email"
            placeholder="vous@exemple.com"
            value={identifier}
            onValueChange={setIdentifier}
            required
            autoFocus
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Code PIN</Label>
        <PinInput id="pin" value={pin} onValueChange={setPin} onComplete={submit} />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || !isFormValid}>
        {pending ? "Connexion..." : "Se connecter"}
      </Button>
    </form>
  );
}
