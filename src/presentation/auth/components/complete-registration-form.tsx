"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";

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
  }) => Promise<void>;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [patronName, setPatronName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await action({ phone, otp, pin, tenantName, patronName });
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
          value={phone}
          onValueChange={setPhone}
          required
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
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patronName">Votre nom</Label>
        <Input id="patronName" value={patronName} onValueChange={setPatronName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tenantName">Nom de votre boutique</Label>
        <Input id="tenantName" value={tenantName} onValueChange={setTenantName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Choisissez un code PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onValueChange={setPin}
          required
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création..." : "Créer mon compte"}
      </Button>
    </form>
  );
}
