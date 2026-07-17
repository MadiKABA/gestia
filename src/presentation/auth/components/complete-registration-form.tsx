"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { OtpInput } from "@/presentation/shared/components/otp-input";
import { PinInput } from "@/presentation/shared/components/pin-input";
import { BusinessTypeSelector } from "@/presentation/shared/components/business-type-selector";
import { commonLabels } from "@/presentation/shared/labels";
import { OTP_LENGTH } from "@/domain/auth/otp";
import { PIN_LENGTH } from "@/domain/auth/pin-policy";
import { DEFAULT_BUSINESS_TYPE, type BusinessTypeCode } from "@/domain/tenant/business-type";

export function CompleteRegistrationForm({
  initialPhone,
  action,
}: {
  initialPhone: string;
  action: (input: {
    phone: string;
    otp: string;
    pin: string;
    tenantName: string;
    patronName: string;
    email?: string;
    businessType: BusinessTypeCode;
  }) => Promise<void>;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [patronName, setPatronName] = useState("");
  const patronNameRef = useRef<HTMLInputElement>(null);
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [businessType, setBusinessType] = useState<BusinessTypeCode>(DEFAULT_BUSINESS_TYPE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(pinValue: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action({
          phone,
          otp,
          pin: pinValue,
          tenantName,
          patronName,
          email: email.trim() ? email.trim() : undefined,
          businessType,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit(pin);
  }

  // Email volontairement absent de ce calcul — champ optionnel.
  const isFormValid =
    phone.trim() !== "" &&
    otp.length === OTP_LENGTH &&
    patronName.trim() !== "" &&
    tenantName.trim() !== "" &&
    pin.length === PIN_LENGTH;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">Numéro de téléphone</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onValueChange={setPhone}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Code reçu par SMS</Label>
        <OtpInput
          id="otp"
          value={otp}
          onValueChange={setOtp}
          onComplete={() => patronNameRef.current?.focus()}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patronName">Votre nom</Label>
        <Input
          id="patronName"
          ref={patronNameRef}
          value={patronName}
          onValueChange={setPatronName}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tenantName">Nom de votre boutique</Label>
        <Input id="tenantName" value={tenantName} onValueChange={setTenantName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email (optionnel)</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder="vous@exemple.com"
          value={email}
          onValueChange={setEmail}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type de commerce</Label>
        <BusinessTypeSelector value={businessType} onChange={setBusinessType} disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Choisissez un code PIN</Label>
        <PinInput id="pin" value={pin} onValueChange={setPin} onComplete={submit} />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || !isFormValid}>
        {pending ? "Création..." : "Créer mon compte"}
      </Button>
    </form>
  );
}
