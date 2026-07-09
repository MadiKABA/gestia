"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { Label } from "@/presentation/shared/components/ui/label";
import { PhoneInput } from "@/presentation/shared/components/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { createPartyOfflineRepository } from "@/presentation/party/offline-repository";
import { commonLabels, partyLabels } from "@/presentation/shared/labels";
import type { PartyType } from "@/domain/party/party.entity";

const NEW_PARTY_TYPE_LABEL: Record<"CLIENT" | "SUPPLIER", string> = {
  CLIENT: partyLabels.typeClient,
  SUPPLIER: partyLabels.typeSupplier,
};

export type PickedParty = { id: string; name: string };

/**
 * Étape "personne" du parcours de création d'opération (page unique et
 * wizard modal mobile) : recherche/sélection d'un tiers existant, ou
 * création à la volée sans quitter le flux. La question client/fournisseur
 * n'est posée que dans ce second cas — un tiers déjà existant garde son type
 * actuel, jamais reposé ici (voir domain/party/party.entity.ts, PartyType
 * déterminé une seule fois à la création, mis à jour uniquement à la main
 * via la fiche Party).
 *
 * `filterType` (page de création unique uniquement, absent dans le wizard) :
 * restreint la recherche aux tiers de ce type et, en création à la volée,
 * fixe directement `newType` sans reposer la question — déduit de la
 * situation choisie à l'étape précédente ("On me doit" → clients, "Je dois"
 * → fournisseurs), jamais redemandé.
 */
export function PartyPickerStep({
  tenantId,
  userId,
  filterType,
  onSelect,
}: {
  tenantId: string;
  userId: string;
  filterType?: "CLIENT" | "SUPPLIER";
  onSelect: (party: PickedParty) => void;
}) {
  const repository = useMemo(
    () => createPartyOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<"CLIENT" | "SUPPLIER">(filterType ?? "CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      void repository.list({ search: search || undefined, type: filterType }).then((parties) => {
        if (cancelled) return;
        setResults(
          parties.map((party) => ({
            id: party.id,
            name: party.name,
            phone: party.phone ?? party.whatsappNumber,
          })),
        );
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, filterType, repository]);

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
        type: newType as PartyType,
        isCompany: false,
        companyName: null,
        contactName: null,
        note: null,
      });
      onSelect({ id: created.id, name: created.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : commonLabels.genericError);
    } finally {
      setPending(false);
    }
  }

  if (creating) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-party-name">{partyLabels.pickerCreateNewNameField}</Label>
          <Input id="new-party-name" value={newName} onValueChange={setNewName} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-party-phone">{partyLabels.pickerCreateNewPhoneField}</Label>
          <PhoneInput id="new-party-phone" value={newPhone} onValueChange={setNewPhone} />
        </div>
        {filterType ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="new-party-type">{partyLabels.pickerTypeQuestion}</Label>
            <Select
              value={newType}
              onValueChange={(value) => setNewType(value as "CLIENT" | "SUPPLIER")}
            >
              <SelectTrigger id="new-party-type" className="w-full">
                <SelectValue>
                  {(value: string) => NEW_PARTY_TYPE_LABEL[value as "CLIENT" | "SUPPLIER"]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT">{partyLabels.typeClient}</SelectItem>
                <SelectItem value="SUPPLIER">{partyLabels.typeSupplier}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
            {commonLabels.cancel}
          </Button>
          <Button className="flex-1" disabled={pending} onClick={() => void confirmNewParty()}>
            {partyLabels.pickerContinueLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder={partyLabels.pickerSearchPlaceholder}
        value={search}
        onValueChange={setSearch}
        autoFocus
      />
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {results.map((party) => (
          <li key={party.id}>
            <button
              type="button"
              onClick={() => onSelect({ id: party.id, name: party.name })}
              className="bg-card border-border hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left shadow-xs transition-colors"
            >
              <span className="text-foreground text-sm font-medium">{party.name}</span>
              {party.phone ? (
                <span className="text-muted-foreground text-sm">{party.phone}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
        {partyLabels.pickerCreateNewLabel}
      </Button>
    </div>
  );
}
