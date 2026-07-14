"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { updateVendeurAction } from "@/presentation/auth/actions";
import { commonLabels, authLabels } from "@/presentation/shared/labels";

/**
 * Modale de modification d'un vendeur — nom uniquement, jamais le téléphone
 * (voir update-vendeur.use-case.ts). Même conteneur/pattern que
 * InviteVendeurModal, un seul champ pré-rempli.
 */
export function EditVendeurModal({
  open,
  onOpenChange,
  vendeur,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendeur: { id: string; name: string } | null;
  onUpdated: (vendeurId: string, name: string) => void;
}) {
  const [name, setName] = useState(vendeur?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // Se resynchronise à chaque nouvelle cible/ouverture — même pattern que
  // PaymentModal (ajustement pendant le rendu, pas un useEffect, pour éviter
  // un flash de l'ancien nom à l'ouverture).
  const [prevVendeurId, setPrevVendeurId] = useState(vendeur?.id ?? null);
  if (open && vendeur && vendeur.id !== prevVendeurId) {
    setPrevVendeurId(vendeur.id);
    setName(vendeur.name);
    setError(null);
  }

  const isFormValid = name.trim() !== "";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!vendeur) return;
    setError(null);
    startSave(async () => {
      try {
        await updateVendeurAction({ vendeurId: vendeur.id, name });
        onUpdated(vendeur.id, name);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={authLabels.editVendeurModalTitle}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-vendeur-name">{authLabels.vendeurNameField}</Label>
          <Input id="edit-vendeur-name" value={name} onValueChange={setName} required />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={saving || !isFormValid}>
          {saving ? authLabels.savingVendeurButtonLabel : authLabels.saveVendeurButtonLabel}
        </Button>
      </form>
    </ResponsivePanel>
  );
}
