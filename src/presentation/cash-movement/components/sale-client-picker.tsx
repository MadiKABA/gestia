"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import { createPartyOfflineRepository } from "@/presentation/party/offline-repository";
import { cashMovementLabels, commonLabels, partyLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";

export type PickedSaleParty = { id: string; name: string };

/**
 * Bloc client optionnel de la vente au comptant — logique distincte de
 * PartyPickerStep (transaction/components/party-picker-step.tsx), actée
 * volontairement : ce flux ne rend jamais un client obligatoire (le
 * formulaire reste validable sans sélection), et la création à la volée
 * n'exige pas de téléphone valide (contactOptional: true sur PartyInput,
 * voir domain/party/party.entity.ts). Recherche restreinte au type CLIENT
 * uniquement — une vente au comptant ne concerne jamais un fournisseur.
 */
export function SaleClientPicker({
  tenantId,
  userId,
  party,
  onSelect,
}: {
  tenantId: string;
  userId: string;
  party: PickedSaleParty | null;
  onSelect: (party: PickedSaleParty | null) => void;
}) {
  const repository = useMemo(
    () => createPartyOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isNewPartyFormValid = newName.trim() !== "";

  useEffect(() => {
    if (!open || creating) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      void repository.list({ search: search || undefined, type: "CLIENT" }).then((parties) => {
        if (cancelled) return;
        setResults(
          parties.map((p) => ({ id: p.id, name: p.name, phone: p.phone ?? p.whatsappNumber })),
        );
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, creating, search, repository]);

  async function confirmNewParty() {
    if (!newName.trim()) {
      setError(partyLabels.nameRequiredError);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await repository.create({
        name: newName.trim(),
        phone: newPhone || null,
        whatsappNumber: null,
        type: "CLIENT",
        isCompany: false,
        companyName: null,
        contactName: null,
        note: null,
        contactOptional: !newPhone.trim(),
      });
      onSelect({ id: created.id, name: created.name });
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : commonLabels.genericError);
    } finally {
      setPending(false);
    }
  }

  function resetAndClose() {
    setOpen(false);
    setCreating(false);
    setSearch("");
    setNewName("");
    setNewPhone("");
    setError(null);
  }

  if (party) {
    return (
      <div className="space-y-1.5">
        <Label>{cashMovementLabels.salePartyField}</Label>
        <div className="bg-card border-border flex items-center justify-between rounded-lg border p-3">
          <span className="text-foreground text-sm font-medium">{party.name}</span>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            {commonLabels.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-dashed p-4",
        open ? "border-border" : "border-muted-foreground/40",
      )}
    >
      <Label>{cashMovementLabels.salePartyField}</Label>

      {!open ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          {cashMovementLabels.salePartyAddButtonLabel}
        </Button>
      ) : creating ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sale-party-name">{partyLabels.pickerCreateNewNameField}</Label>
            <Input id="sale-party-name" value={newName} onValueChange={setNewName} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-party-phone">{cashMovementLabels.salePartyPhoneField}</Label>
            <PhoneInput id="sale-party-phone" value={newPhone} onValueChange={setNewPhone} />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
              {commonLabels.cancel}
            </Button>
            <Button
              className="flex-1"
              disabled={pending || !isNewPartyFormValid}
              onClick={() => void confirmNewParty()}
            >
              {partyLabels.pickerContinueLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            placeholder={partyLabels.pickerSearchPlaceholder}
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ id: p.id, name: p.name });
                    resetAndClose();
                  }}
                  className="bg-card border-border hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left shadow-xs transition-colors"
                >
                  <span className="text-foreground text-sm font-medium">{p.name}</span>
                  {p.phone ? (
                    <span className="text-muted-foreground text-sm">{p.phone}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={resetAndClose}>
              {commonLabels.cancel}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setCreating(true)}>
              {partyLabels.pickerCreateNewLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
