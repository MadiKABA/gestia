"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { createProductCategoryOfflineRepository } from "@/presentation/product-category/offline-repository";
import { productCategoryLabels } from "@/presentation/shared/labels";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import type { ProductCategory } from "@/domain/product-category/product-category.entity";

/**
 * Modale de création/modification d'une catégorie — un seul champ, même
 * conteneur/pattern que EditVendeurModal (cas similaire de formulaire à un
 * seul champ). `category` null = création, sinon modification.
 */
export function CategoryFormModal({
  open,
  onOpenChange,
  tenantId,
  userId,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userId: string;
  category: ProductCategory | null;
  onSaved: (category: ProductCategory) => void;
}) {
  const mode = category ? "edit" : "create";
  const [name, setName] = useState(category?.name ?? "");
  const [saving, startSave] = useTransition();

  // Se resynchronise à chaque nouvelle cible/ouverture — même pattern que
  // EditVendeurModal (ajustement pendant le rendu, pas un useEffect).
  const [prevCategoryId, setPrevCategoryId] = useState(category?.id ?? null);
  if (open && (category?.id ?? null) !== prevCategoryId) {
    setPrevCategoryId(category?.id ?? null);
    setName(category?.name ?? "");
  }

  const isFormValid = name.trim() !== "";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startSave(async () => {
      let wasQueuedOffline = false;
      try {
        const repository = createProductCategoryOfflineRepository(tenantId, userId, () => {
          wasQueuedOffline = true;
        });
        const saved =
          mode === "create"
            ? await repository.create({ name })
            : await repository.update(category!.id, { name });
        if (wasQueuedOffline) {
          toastQueuedOffline();
        } else {
          toastSuccess(
            mode === "create"
              ? productCategoryLabels.createdToastMessage
              : productCategoryLabels.updatedToastMessage,
          );
        }
        onSaved(saved);
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "create"
          ? productCategoryLabels.newModalTitle
          : productCategoryLabels.editModalTitle
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">{productCategoryLabels.nameField}</Label>
          <Input id="category-name" value={name} onValueChange={setName} autoFocus required />
        </div>
        <Button type="submit" className="w-full" disabled={saving || !isFormValid}>
          {mode === "create"
            ? productCategoryLabels.createSubmitLabel
            : productCategoryLabels.editSubmitLabel}
        </Button>
      </form>
    </ResponsivePanel>
  );
}
