"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { inviteVendeurAction } from "@/presentation/auth/actions";
import { commonLabels, authLabels } from "@/presentation/shared/labels";

/**
 * Conteneur modal du formulaire d'invitation — même logique/validation
 * qu'avant (formulaire inline), seul le conteneur change. L'affichage du
 * lien de première connexion après succès reste géré par le parent
 * (VendeursPanel) : cette modale se contente de se fermer et de signaler
 * le téléphone invité via `onInvited`.
 */
export function InviteVendeurModal({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const invitedPhone = phone;
    startInvite(async () => {
      try {
        await inviteVendeurAction({ name, phone: invitedPhone });
        setName("");
        setPhone("");
        onInvited(invitedPhone);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={authLabels.inviteVendeurModalTitle}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="vendeur-name">{authLabels.vendeurNameField}</Label>
          <Input id="vendeur-name" value={name} onValueChange={setName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendeur-phone">{authLabels.vendeurPhoneField}</Label>
          <PhoneInput id="vendeur-phone" value={phone} onValueChange={setPhone} required />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={inviting}>
          {inviting ? authLabels.invitingButtonLabel : authLabels.inviteButtonLabel}
        </Button>
      </form>
    </ResponsivePanel>
  );
}
