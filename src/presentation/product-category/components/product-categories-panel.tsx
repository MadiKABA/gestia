"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Ban } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import { createProductCategoryOfflineRepository } from "@/presentation/product-category/offline-repository";
import { CategoryFormModal } from "@/presentation/product-category/components/category-form-modal";
import { productCategoryLabels, commonLabels } from "@/presentation/shared/labels";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import type { ProductCategory } from "@/domain/product-category/product-category.entity";

export type ProductCategoryRow = ProductCategory & { productCount: number };

/** Nombre de catégories affichées par page — même pattern que
 * products-list.tsx/vendeurs-panel.tsx (PAGE_SIZE + visibleCount, pas de
 * composant de pagination dédié dans l'app). */
const PAGE_SIZE = 20;

export function ProductCategoriesPanel({
  initialCategories,
  tenantId,
  userId,
}: {
  initialCategories: ProductCategoryRow[];
  tenantId: string;
  userId: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [formTarget, setFormTarget] = useState<{
    open: boolean;
    category: ProductCategory | null;
  }>({ open: false, category: null });
  const [deleteTarget, setDeleteTarget] = useState<ProductCategoryRow | null>(null);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [prevInitialCategories, setPrevInitialCategories] = useState(initialCategories);
  if (initialCategories !== prevInitialCategories) {
    setPrevInitialCategories(initialCategories);
    setCategories(initialCategories);
  }

  const repository = useMemo(
    () => createProductCategoryOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );

  const visibleCategories = categories.slice(0, visibleCount);

  function onSaved(saved: ProductCategory) {
    setCategories((current) => {
      const exists = current.some((c) => c.id === saved.id);
      if (exists) {
        return current.map((c) => (c.id === saved.id ? { ...c, name: saved.name } : c));
      }
      return [...current, { ...saved, productCount: 0 }];
    });
    setFormTarget({ open: false, category: null });
    router.refresh();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    startDelete(async () => {
      try {
        await repository.delete(deleteTarget.id);
        setCategories((current) => current.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
        toastSuccess(productCategoryLabels.deletedToastMessage);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
        toastError(resolveErrorMessage(err));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-foreground text-lg font-semibold">
            {productCategoryLabels.listTitle}
          </h1>
          <p className="text-muted-foreground text-sm">{productCategoryLabels.listDescription}</p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => setFormTarget({ open: true, category: null })}
        >
          {productCategoryLabels.newButtonLabel}
        </Button>
      </div>

      <CategoryFormModal
        open={formTarget.open}
        onOpenChange={(open) => setFormTarget((current) => ({ ...current, open }))}
        tenantId={tenantId}
        userId={userId}
        category={formTarget.category}
        onSaved={onSaved}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
        <p className="text-muted-foreground text-sm">{productCategoryLabels.totalCountLabel}</p>
        <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
          {categories.length}
        </p>
      </div>

      {/* Mobile (< lg) : cartes. */}
      <ul className="grid grid-cols-1 gap-2 lg:hidden">
        {visibleCategories.map((category) => (
          <li
            key={category.id}
            className="bg-card border-border flex items-center justify-between gap-2 rounded-lg border p-3 shadow-xs"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{category.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {category.productCount} {productCategoryLabels.productCountColumnLabel}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormTarget({ open: true, category })}
              >
                {productCategoryLabels.editButtonLabel}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(category)}>
                {commonLabels.delete}
              </Button>
            </div>
          </li>
        ))}
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">{productCategoryLabels.emptyStateList}</p>
        ) : null}
      </ul>

      {/* Desktop/tablette (≥ lg) : tableau avec actions par ligne. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">{productCategoryLabels.nameColumnLabel}</th>
              <th className="px-3 py-2 font-medium">
                {productCategoryLabels.productCountColumnLabel}
              </th>
              <th className="px-3 py-2 font-medium">{productCategoryLabels.actionsColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((category) => (
              <tr key={category.id} className="border-border border-b last:border-b-0">
                <td className="text-foreground px-3 py-2">{category.name}</td>
                <td className="px-3 py-2 tabular-nums">{category.productCount}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={productCategoryLabels.editButtonLabel}
                      onClick={() => setFormTarget({ open: true, category })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={commonLabels.delete}
                      onClick={() => setDeleteTarget(category)}
                    >
                      <Ban aria-hidden />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            {productCategoryLabels.emptyStateList}
          </p>
        ) : null}
      </div>

      {visibleCount < categories.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {productCategoryLabels.showMoreLabel}
        </Button>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={productCategoryLabels.deleteConfirmTitle(deleteTarget?.name ?? "")}
        description={productCategoryLabels.deleteConfirmDescription}
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
