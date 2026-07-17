"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { IdentifierToggle } from "@/presentation/auth/components/identifier-toggle";
import type { RequestOtpResult } from "@/presentation/auth/actions";
import type { LocaleCountryCode } from "@/domain/shared/locale-country";

type Channel = "PHONE" | "EMAIL";

/** Écran "identifiant" partagé par l'inscription et la réinitialisation de
 * PIN : envoie un OTP puis passe à l'écran suivant avec le canal/identifiant
 * en query. `allowEmail` n'active le toggle Téléphone/Email que pour la
 * réinitialisation de PIN — l'inscription reste 100% téléphone/SMS (§4). */
export function RequestOtpForm({
  action,
  nextPathBase,
  submitLabel,
  allowEmail = false,
  initialIdentifier = "",
  defaultCountryCode,
}: {
  action: (input: { channel: Channel; identifier: string }) => Promise<RequestOtpResult>;
  nextPathBase: string;
  submitLabel: string;
  allowEmail?: boolean;
  /** Pré-rempli quand on arrive ici depuis un lien qui connaît déjà
   * l'identifiant (ex. /premiere-connexion en cas de code expiré, voir
   * app/(auth)/reset-pin/page.tsx) — évite au vendeur de ressaisir son
   * numéro qu'il vient déjà de fournir une fois. */
  initialIdentifier?: string;
  /** Indicatif pré-sélectionné (détection Accept-Language, voir
   * app/(auth)/register/page.tsx) — transmis tel quel à `PhoneInput`. */
  defaultCountryCode?: LocaleCountryCode;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("PHONE");
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChannelChange(next: Channel) {
    setChannel(next);
    setIdentifier("");
  }

  const isFormValid = identifier.trim() !== "";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await action({ channel, identifier });
      if (result.success) {
        const query = allowEmail
          ? `channel=${channel}&identifier=${encodeURIComponent(identifier)}`
          : `phone=${encodeURIComponent(identifier)}`;
        router.push(`${nextPathBase}?${query}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {allowEmail ? <IdentifierToggle value={channel} onChange={onChannelChange} /> : null}
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
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || !isFormValid}>
        {pending ? "Envoi en cours..." : submitLabel}
      </Button>
    </form>
  );
}
