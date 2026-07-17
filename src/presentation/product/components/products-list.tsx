"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Pencil, Ban, ImageOff } from "lucide-react";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { Badge } from "@/presentation/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import {
  createProductOfflineRepository,
  seedProductCache,
} from "@/presentation/product/offline-repository";
import { productLabels, commonLabels } from "@/presentation/shared/labels";
import { formatAmount } from "@/presentation/shared/format-amount";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import type { Product, ProductType } from "@/domain/product/product.entity";
import type { CurrencyCode } from "@/config/currencies";

type TypeFilter = "ALL" | ProductType;

const TYPE_FILTERS = [
  { value: "ALL", label: productLabels.filterAll },
  { value: "PRODUIT", label: productLabels.typeProduit },
  { value: "SERVICE", label: productLabels.typeService },
] as const;

const TYPE_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_FILTERS.map((option) => [option.value, option.label]),
);

const NO_CATEGORY_FILTER_VALUE = "__all__";

/** Nombre de produits affichés par page — jamais toute la liste d'un coup,
 * même règle que TransactionsList/PartiesList. */
const PAGE_SIZE = 20;

type CategoryOption = { id: string; name: string };

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — même pattern que TransactionsList/PartiesList. */
export function ProductsList({
  initialProducts,
  tenantId,
  userId,
  canManage,
  categories,
  currency,
}: {
  initialProducts: Product[];
  tenantId: string;
  userId: string;
  /** PATRON uniquement — le vendeur consulte/sélectionne, jamais créer/
   * modifier/supprimer (cf. CLAUDE.md Rôles). */
  canManage: boolean;
  categories: CategoryOption[];
  currency: CurrencyCode;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("ALL");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY_FILTER_VALUE);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const repository = useMemo(
    () => createProductOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [prevInitialProducts, setPrevInitialProducts] = useState(initialProducts);
  if (initialProducts !== prevInitialProducts) {
    setPrevInitialProducts(initialProducts);
    setProducts(initialProducts);
  }

  useEffect(() => {
    void seedProductCache(tenantId, initialProducts);
  }, [tenantId, initialProducts]);

  useEffect(() => {
    void repository
      .list({
        type: type === "ALL" ? undefined : type,
        categoryId: categoryId === NO_CATEGORY_FILTER_VALUE ? undefined : categoryId,
      })
      .then((results) => {
        setProducts(results);
        setVisibleCount(PAGE_SIZE);
      });
  }, [type, categoryId, repository]);

  async function refresh() {
    const results = await repository.list({
      type: type === "ALL" ? undefined : type,
      categoryId: categoryId === NO_CATEGORY_FILTER_VALUE ? undefined : categoryId,
    });
    setProducts(results);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    startDelete(async () => {
      try {
        await repository.delete(deleteTarget.id);
        setDeleteTarget(null);
        await refresh();
        toastSuccess(productLabels.updatedToastMessage);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
        toastError(resolveErrorMessage(err));
      }
    });
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.barcode ?? "").toLowerCase().includes(term),
    );
  }, [products, search]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  const produitCount = useMemo(
    () => products.filter((product) => product.type === "PRODUIT").length,
    [products],
  );
  const serviceCount = products.length - produitCount;
  const outOfStockCount = useMemo(
    () =>
      products.filter((product) => product.trackStock && (product.stockQuantity ?? 0) <= 0).length,
    [products],
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-foreground text-lg font-semibold">{productLabels.listTitle}</h1>
        {canManage ? (
          <Button
            size="sm"
            render={<Link href="/produits/nouveau" />}
            nativeButton={false}
            className="shrink-0"
          >
            {productLabels.newButtonLabel}
          </Button>
        ) : null}
      </div>

      {/* Cartes résumé desktop/tablette uniquement — même convention que
          TransactionsList (mobile reste à l'essentiel : recherche + liste). */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{productLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {products.length}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">
            {productLabels.typeProduit} / {productLabels.typeService}
          </p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {produitCount} / {serviceCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{productLabels.outOfStockBadgeLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#C0392B] tabular-nums">
            {outOfStockCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={productLabels.nameColumnLabel}
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {(value: string) => TYPE_FILTER_LABEL_BY_VALUE[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryId}
            onValueChange={(value) => setCategoryId(value ?? NO_CATEGORY_FILTER_VALUE)}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: string) => categoryById.get(value)?.name ?? productLabels.categoryField}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY_FILTER_VALUE}>{productLabels.filterAll}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {/* Mobile (< lg) : cartes. */}
      <ul className="grid grid-cols-1 gap-2 lg:hidden">
        {visibleProducts.map((product) => (
          <li
            key={product.id}
            className="bg-card border-border flex items-center gap-3 rounded-lg border p-3 shadow-xs"
          >
            <ProductThumbnail product={product} />
            <Link href={`/produits/${product.id}/modifier`} className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{product.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {categoryById.get(product.categoryId ?? "")?.name ?? "—"}
              </p>
              {product.trackStock && (product.stockQuantity ?? 0) <= 0 ? (
                <Badge variant="alert">{productLabels.outOfStockBadgeLabel}</Badge>
              ) : null}
            </Link>
            <span className="text-foreground shrink-0 text-sm font-medium tabular-nums">
              {formatAmount(product.price, currency)}
            </span>
          </li>
        ))}
        {filteredProducts.length === 0 ? (
          <p className="text-muted-foreground text-sm">{productLabels.emptyStateList}</p>
        ) : null}
      </ul>

      {/* Desktop/tablette (≥ lg) : tableau avec actions par ligne. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">{productLabels.nameColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{productLabels.categoryColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{productLabels.priceColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{productLabels.stockColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{productLabels.actionsColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr key={product.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <ProductThumbnail product={product} />
                </td>
                <td className="px-3 py-2">
                  <p className="text-foreground">{product.name}</p>
                  {product.barcode ? (
                    <p className="text-muted-foreground text-xs">{product.barcode}</p>
                  ) : null}
                </td>
                <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                  {categoryById.get(product.categoryId ?? "")?.name ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatAmount(product.price, currency)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {product.trackStock ? (
                    (product.stockQuantity ?? 0) <= 0 ? (
                      <Badge variant="alert">{productLabels.outOfStockBadgeLabel}</Badge>
                    ) : (
                      <span className="tabular-nums">{product.stockQuantity}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={productLabels.viewActionLabel}
                      render={<Link href={`/produits/${product.id}/modifier`} />}
                      nativeButton={false}
                    >
                      <Eye aria-hidden />
                    </Button>
                    {canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={productLabels.editButtonLabel}
                          render={<Link href={`/produits/${product.id}/modifier`} />}
                          nativeButton={false}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={commonLabels.delete}
                          onClick={() => setDeleteTarget(product)}
                        >
                          <Ban aria-hidden />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{productLabels.emptyStateList}</p>
        ) : null}
      </div>

      {visibleCount < filteredProducts.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {productLabels.showMoreLabel}
        </Button>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={productLabels.deleteConfirmTitle(deleteTarget?.name ?? "")}
        description={productLabels.deleteConfirmDescription}
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ProductThumbnail({ product }: { product: Product }) {
  if (product.photoUrl) {
    return (
      <Image
        src={product.photoUrl}
        alt=""
        width={40}
        height={40}
        className="border-border size-10 shrink-0 rounded-lg border object-cover"
      />
    );
  }
  return (
    <div className="border-border bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
      <ImageOff className="size-4" aria-hidden="true" />
    </div>
  );
}
