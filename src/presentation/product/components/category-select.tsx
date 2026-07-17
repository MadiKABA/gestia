"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { createProductCategoryOfflineRepository } from "@/presentation/product-category/offline-repository";
import { commonLabels, productLabels } from "@/presentation/shared/labels";

const NONE_VALUE = "__none__";
const CREATE_NEW_VALUE = "__create_new__";

/**
 * Sélection d'une catégorie existante, avec création à la volée sans quitter
 * le formulaire produit (simple champ texte) — même besoin que
 * PartyPickerStep (transaction/components/party-picker-step.tsx) pour un
 * tiers, en plus simple : pas de recherche, la liste des catégories reste
 * courte par nature.
 */
export function CategorySelect({
  tenantId,
  userId,
  value,
  onChange,
  id,
  initialCategories,
}: {
  tenantId: string;
  userId: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  id?: string;
  initialCategories: { id: string; name: string }[];
}) {
  const repository = useMemo(
    () => createProductCategoryOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void repository.list().then((cached) => {
      // Le cache local peut être vide juste après le premier chargement (pas
      // encore semé) : ne jamais remplacer une liste déjà affichée par une
      // liste vide, seulement compléter/rafraîchir.
      if (cached.length > 0) setCategories(cached);
    });
  }, [repository]);

  async function confirmCreate() {
    if (!newName.trim()) return;
    setPending(true);
    setError(null);
    try {
      const created = await repository.create({ name: newName.trim() });
      setCategories((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onChange(created.id);
      setCreating(false);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : commonLabels.genericError);
    } finally {
      setPending(false);
    }
  }

  if (creating) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newName}
            onValueChange={setNewName}
            placeholder={productLabels.categoryNewNamePlaceholder}
            autoFocus
          />
          <Button type="button" variant="outline" onClick={() => setCreating(false)}>
            {commonLabels.cancel}
          </Button>
          <Button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() => void confirmCreate()}
          >
            {productLabels.categoryAddButtonLabel}
          </Button>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    );
  }

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => {
        if (next === CREATE_NEW_VALUE) {
          setCreating(true);
          return;
        }
        onChange(next === NONE_VALUE ? null : next);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={productLabels.categoryPlaceholder}>
          {(selectedValue: string) =>
            categories.find((category) => category.id === selectedValue)?.name ??
            productLabels.categoryNoneLabel
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{productLabels.categoryNoneLabel}</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
        <SelectItem value={CREATE_NEW_VALUE}>{productLabels.categoryCreateNewLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
