"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { inviteVendeurAction, deactivateVendeurAction } from "@/presentation/auth/actions";

type Vendeur = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
};

export function VendeursPanel({ initialVendeurs }: { initialVendeurs: Vendeur[] }) {
  const router = useRouter();
  const [vendeurs, setVendeurs] = useState(initialVendeurs);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivating, startDeactivate] = useTransition();

  function onInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startInvite(async () => {
      try {
        await inviteVendeurAction({ name, phone });
        setName("");
        setPhone("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      } finally {
        router.refresh();
      }
    });
  }

  function onDeactivate(vendeurId: string) {
    setError(null);
    setDeactivatingId(vendeurId);
    startDeactivate(async () => {
      try {
        await deactivateVendeurAction({ vendeurId });
        setVendeurs((current) =>
          current.map((v) => (v.id === vendeurId ? { ...v, active: false } : v)),
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      }
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-8 p-4">
      <div>
        <h1 className="text-foreground text-lg font-semibold">Vendeurs</h1>
        <p className="text-muted-foreground text-sm">
          Invitez un vendeur ou désactivez son accès à la boutique.
        </p>
      </div>

      <form onSubmit={onInvite} className="border-border space-y-4 rounded-xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="vendeur-name">Nom du vendeur</Label>
          <Input id="vendeur-name" value={name} onValueChange={setName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendeur-phone">Numéro de téléphone</Label>
          <PhoneInput id="vendeur-phone" value={phone} onValueChange={setPhone} required />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={inviting}>
          {inviting ? "Invitation..." : "Inviter"}
        </Button>
      </form>

      <ul className="space-y-2">
        {vendeurs.map((vendeur) => (
          <li
            key={vendeur.id}
            className="border-border flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="text-foreground text-sm font-medium">{vendeur.name}</p>
              <p className="text-muted-foreground text-sm">{vendeur.phone}</p>
            </div>
            {vendeur.active ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={deactivating && deactivatingId === vendeur.id}
                onClick={() => onDeactivate(vendeur.id)}
              >
                {deactivating && deactivatingId === vendeur.id ? "Désactivation..." : "Désactiver"}
              </Button>
            ) : (
              <span className="text-muted-foreground text-sm">Désactivé</span>
            )}
          </li>
        ))}
        {vendeurs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun vendeur pour le moment.</p>
        ) : null}
      </ul>
    </div>
  );
}
