"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { inviteVendeurAction, deactivateVendeurAction } from "@/presentation/auth/actions";
import { commonLabels, authLabels } from "@/presentation/shared/labels";
import { buildPremiereConnexionLink } from "@/domain/auth/premiere-connexion-link";

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
  const [invitedLink, setInvitedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const invitedPhone = phone;
    startInvite(async () => {
      try {
        await inviteVendeurAction({ name, phone: invitedPhone });
        setName("");
        setPhone("");
        setCopied(false);
        // Le SMS envoyé porte déjà ce lien (voir sms-otp-sender.ts) — l'afficher
        // ici permet au patron de le transmettre lui-même (WhatsApp, etc.) si
        // le SMS n'arrive pas ou si le vendeur n'a pas son téléphone sous la
        // main. Même fonction pure que côté serveur, jamais dupliquée.
        setInvitedLink(buildPremiereConnexionLink(process.env.NEXT_PUBLIC_APP_URL!, invitedPhone));
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      } finally {
        router.refresh();
      }
    });
  }

  async function onCopyLink() {
    if (!invitedLink) return;
    try {
      await navigator.clipboard.writeText(invitedLink);
      setCopied(true);
    } catch {
      // Permission clipboard refusée/indisponible (contexte non sécurisé,
      // navigateur non supporté) : le lien reste affiché en clair
      // juste au-dessus, sélectionnable/copiable manuellement — jamais un
      // clic sans aucun retour.
      setError(authLabels.copyLinkFailedMessage);
    }
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
        setError(err instanceof Error ? err.message : commonLabels.genericError);
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

      {invitedLink ? (
        <div className="border-primary/30 bg-primary/5 space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-foreground text-sm font-medium">{authLabels.vendeurInvitedTitle}</p>
            <p className="text-muted-foreground text-sm">{authLabels.vendeurInvitedDescription}</p>
          </div>
          <p className="border-border bg-card overflow-x-auto rounded-lg border p-2 text-xs break-all">
            {invitedLink}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void onCopyLink()}>
              {copied ? authLabels.linkCopiedButton : authLabels.copyLinkButton}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setInvitedLink(null)}>
              {authLabels.dismissVendeurInvitedLabel}
            </Button>
          </div>
        </div>
      ) : null}

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
