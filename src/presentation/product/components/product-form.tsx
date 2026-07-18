"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { Switch } from "@/presentation/shared/components/ui/switch";
import { BackLink } from "@/presentation/shared/components/back-link";
import { ProductUnitSelector } from "@/presentation/product/components/product-unit-selector";
import { CategorySelect } from "@/presentation/product/components/category-select";
import { ProductPhotoInput } from "@/presentation/product/components/product-photo-input";
import { BarcodeInput } from "@/presentation/product/components/barcode-input";
import {
  productInputSchema,
  toProductInput,
  type ProductFormInput,
} from "@/presentation/product/schemas";
import { productLabels } from "@/presentation/shared/labels";
import { createProductOfflineRepository } from "@/presentation/product/offline-repository";
import { toastError, toastQueuedOffline, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import { cn } from "@/lib/utils";
import type { ProductPhoto } from "@/domain/product/product.entity";
import type { CurrencyCode } from "@/config/currencies";

const DEFAULT_VALUES: ProductFormInput = {
  name: "",
  description: "",
  type: "PRODUIT",
  purchasePrice: null,
  sellingPrice: 0,
  unit: null,
  trackStock: false,
  stockQuantity: null,
  barcode: "",
  categoryId: null,
};

export function ProductForm({
  mode,
  productId,
  tenantId,
  userId,
  currency,
  defaultValues,
  existingPhotoUrl,
  initialCategories,
  submitLabel,
}: {
  mode: "create" | "edit";
  /** Requis en mode "edit". */
  productId?: string;
  tenantId: string;
  userId: string;
  currency: CurrencyCode;
  defaultValues?: Partial<ProductFormInput>;
  existingPhotoUrl?: string | null;
  initialCategories: { id: string; name: string }[];
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Séparé de react-hook-form : la photo n'est jamais un champ Zod du
  // formulaire (voir toProductInput), seulement combinée aux autres valeurs
  // à la soumission — `undefined` = aucun changement, `null` = suppression.
  const [photo, setPhoto] = useState<ProductPhoto | null | undefined>(undefined);
  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isValid },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
    mode: "onChange",
  });

  const type = watch("type");
  const trackStock = watch("trackStock");

  // Même raison que PartyForm : en mode édition, les valeurs par défaut sont
  // déjà valides mais le bouton resterait désactivé tant qu'aucun champ n'est
  // touché sans ce déclenchement initial.
  useEffect(() => {
    void trigger();
  }, [trigger]);

  function submit(values: ProductFormInput) {
    startTransition(async () => {
      let wasQueuedOffline = false;
      try {
        const repository = createProductOfflineRepository(tenantId, userId, () => {
          wasQueuedOffline = true;
        });
        const input = toProductInput(values, photo);
        if (mode === "create") {
          await repository.create(input);
        } else {
          await repository.update(productId!, input);
        }
        if (wasQueuedOffline) {
          toastQueuedOffline();
        } else {
          toastSuccess(
            mode === "create"
              ? productLabels.createdToastMessage
              : productLabels.updatedToastMessage,
          );
        }
        router.push("/produits");
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="mx-auto w-full max-w-md space-y-6 p-4 lg:max-w-4xl"
    >
      <BackLink href="/produits" />
      <h1 className="text-foreground text-lg font-semibold">
        {mode === "create" ? productLabels.newPageTitle : productLabels.editPageTitle}
      </h1>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label>{productLabels.typeQuestion}</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={field.value === "PRODUIT"}
                    onClick={() => field.onChange("PRODUIT")}
                    className={cn(
                      "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                      field.value === "PRODUIT"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {productLabels.typeProduit}
                  </button>
                  <button
                    type="button"
                    aria-pressed={field.value === "SERVICE"}
                    onClick={() => field.onChange("SERVICE")}
                    className={cn(
                      "rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                      field.value === "SERVICE"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {productLabels.typeService}
                  </button>
                </div>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">{productLabels.nameField}</Label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  id="name"
                  value={field.value}
                  onValueChange={field.onChange}
                  autoFocus
                  aria-invalid={!!errors.name}
                />
              )}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{productLabels.descriptionField}</Label>
            <Textarea id="description" {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchasePrice">{productLabels.purchasePriceField(currency)}</Label>
            <Controller
              control={control}
              name="purchasePrice"
              render={({ field }) => (
                <Input
                  id="purchasePrice"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={field.value == null ? "" : String(field.value)}
                  onValueChange={(value) => field.onChange(value === "" ? null : Number(value))}
                  aria-invalid={!!errors.purchasePrice}
                />
              )}
            />
            {errors.purchasePrice ? (
              <p className="text-destructive text-sm">{errors.purchasePrice.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sellingPrice">{productLabels.sellingPriceField(currency)}</Label>
            <Controller
              control={control}
              name="sellingPrice"
              render={({ field }) => (
                <Input
                  id="sellingPrice"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={field.value === 0 ? "" : String(field.value)}
                  onValueChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
                  aria-invalid={!!errors.sellingPrice}
                />
              )}
            />
            {errors.sellingPrice ? (
              <p className="text-destructive text-sm">{errors.sellingPrice.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          {type === "PRODUIT" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="unit">{productLabels.unitField}</Label>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <ProductUnitSelector
                      id="unit"
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="border-border flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="trackStock">{productLabels.trackStockLabel}</Label>
                  <p className="text-muted-foreground text-sm">
                    {productLabels.trackStockDescription}
                  </p>
                </div>
                <Controller
                  control={control}
                  name="trackStock"
                  render={({ field }) => (
                    <Switch
                      id="trackStock"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {trackStock ? (
                <div className="space-y-1.5">
                  <Label htmlFor="stockQuantity">{productLabels.stockQuantityField}</Label>
                  <Controller
                    control={control}
                    name="stockQuantity"
                    render={({ field }) => (
                      <Input
                        id="stockQuantity"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={field.value == null ? "" : String(field.value)}
                        onValueChange={(value) =>
                          field.onChange(value === "" ? null : Number(value))
                        }
                      />
                    )}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="category">{productLabels.categoryField}</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <CategorySelect
                  id="category"
                  tenantId={tenantId}
                  userId={userId}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  initialCategories={initialCategories}
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="barcode">{productLabels.barcodeField}</Label>
            <Controller
              control={control}
              name="barcode"
              render={({ field }) => (
                <BarcodeInput
                  id="barcode"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{productLabels.photoField}</Label>
            <ProductPhotoInput
              value={photo}
              onChange={setPhoto}
              existingPhotoUrl={existingPhotoUrl}
            />
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending || !isValid}>
        {submitLabel}
      </Button>
    </form>
  );
}
