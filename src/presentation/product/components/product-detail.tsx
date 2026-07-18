"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Badge } from "@/presentation/shared/components/ui/badge";
import { BackLink } from "@/presentation/shared/components/back-link";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import {
  createProductOfflineRepository,
  seedProductCache,
} from "@/presentation/product/offline-repository";
import { productLabels, commonLabels } from "@/presentation/shared/labels";
import { formatAmount } from "@/presentation/shared/format-amount";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import { PRODUCT_UNIT_CONFIG } from "@/domain/product/product-unit";
import type { Product } from "@/domain/product/product.entity";
import type { CurrencyCode } from "@/config/currencies";

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — même pattern que PartyDetail/ProductsList. */
export function ProductDetail({
  product: initialProduct,
  categoryName,
  tenantId,
  userId,
  canManage,
  currency,
}: {
  product: Product;
  categoryName: string | null;
  tenantId: string;
  userId: string;
  /** PATRON uniquement — le vendeur consulte, jamais modifier/supprimer
   * (cf. CLAUDE.md Rôles). */
  canManage: boolean;
  currency: CurrencyCode;
}) {
  const [product, setProduct] = useState(initialProduct);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  // Amorce le cache local avec les données serveur fraîches (SSR) — pour
  // qu'une prochaine visite hors ligne de ce produit le retrouve déjà là.
  useEffect(() => {
    void seedProductCache(tenantId, [product]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, product.id]);

  // Auto-guérison au montage, même pattern que PartyDetail : relit
  // IndexedDB pour refléter tout de suite une mutation locale pas encore
  // synchronisée plutôt que rester bloqué sur l'instantané serveur reçu à
  // ce chargement.
  useEffect(() => {
    let cancelled = false;
    const repository = createProductOfflineRepository(tenantId, userId);
    void repository.getById(initialProduct.id).then((cached) => {
      if (!cancelled && cached) setProduct(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId, initialProduct.id]);

  function onDelete() {
    startDelete(async () => {
      try {
        const repository = createProductOfflineRepository(tenantId, userId);
        await repository.delete(product.id);
        router.push("/produits");
      } catch (err) {
        setConfirmOpen(false);
        toastError(resolveErrorMessage(err));
        return;
      }
      toastSuccess(productLabels.updatedToastMessage);
    });
  }

  const unitConfig = product.unit ? PRODUCT_UNIT_CONFIG[product.unit] : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-2xl">
      <BackLink href="/produits" />

      <div className="bg-card border-border flex items-start gap-4 rounded-xl border p-4 shadow-xs">
        {product.photoUrl ? (
          <Image
            src={product.photoUrl}
            alt=""
            width={64}
            height={64}
            className="border-border size-16 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <div className="border-border bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-lg border">
            <ImageOff className="size-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground text-lg font-semibold">{product.name}</h1>
          <p className="text-muted-foreground text-sm">
            {product.type === "PRODUIT" ? productLabels.typeProduit : productLabels.typeService}
            {categoryName ? ` · ${categoryName}` : ""}
          </p>
          {product.trackStock && (product.stockQuantity ?? 0) <= 0 ? (
            <Badge variant="alert" className="mt-1">
              {productLabels.outOfStockBadgeLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="bg-card border-border space-y-2 rounded-xl border p-4 text-sm shadow-xs">
        <p>
          <span className="text-muted-foreground">
            {productLabels.sellingPriceField(currency)} :{" "}
          </span>
          <span className="tabular-nums">{formatAmount(product.sellingPrice, currency)}</span>
        </p>
        {product.purchasePrice != null ? (
          <p>
            <span className="text-muted-foreground">
              {productLabels.purchasePriceField(currency)} :{" "}
            </span>
            <span className="tabular-nums">{formatAmount(product.purchasePrice, currency)}</span>
          </p>
        ) : null}
        {unitConfig ? (
          <p>
            <span className="text-muted-foreground">{productLabels.unitField} : </span>
            {unitConfig.label}
          </p>
        ) : null}
        {product.trackStock ? (
          <p>
            <span className="text-muted-foreground">{productLabels.stockQuantityField} : </span>
            <span className="tabular-nums">{product.stockQuantity}</span>
          </p>
        ) : null}
        {product.barcode ? (
          <p>
            <span className="text-muted-foreground">{productLabels.barcodeField} : </span>
            {product.barcode}
          </p>
        ) : null}
        {product.description ? (
          <p>
            <span className="text-muted-foreground">{productLabels.descriptionField} : </span>
            {product.description}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href={`/produits/${product.id}/modifier`} />}
            nativeButton={false}
          >
            {productLabels.editButtonLabel}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={deleting}
            onClick={() => setConfirmOpen(true)}
          >
            {commonLabels.delete}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={productLabels.deleteConfirmTitle(product.name)}
        description={productLabels.deleteConfirmDescription}
        pending={deleting}
        onConfirm={onDelete}
      />
    </div>
  );
}
