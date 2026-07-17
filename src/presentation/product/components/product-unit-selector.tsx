"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { PRODUCT_UNIT_CODES, PRODUCT_UNIT_CONFIG } from "@/domain/product/product-unit";
import type { ProductUnit } from "@/domain/product/product.entity";
import { PRODUCT_UNIT_ICONS } from "@/presentation/product/product-unit-icons";
import { productLabels } from "@/presentation/shared/labels";

/**
 * Carrousel tactile (< lg, même scroll-snap que BusinessTypeSelector) /
 * `Select` desktop avec icône à gauche du libellé pour chaque option —
 * délibérément différent de BusinessTypeSelector côté desktop (grille de
 * boutons) : ici l'unité est une option parmi 17, un dropdown reste plus
 * lisible qu'une grille sur cette taille de liste.
 */
export function ProductUnitSelector({
  value,
  onChange,
  id,
}: {
  value: ProductUnit | null;
  onChange: (value: ProductUnit) => void;
  id?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto pb-1 lg:hidden",
          "[-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
        )}
        role="group"
        aria-label={productLabels.unitField}
      >
        {PRODUCT_UNIT_CODES.map((code) => {
          const config = PRODUCT_UNIT_CONFIG[code];
          const Icon = PRODUCT_UNIT_ICONS[config.icon];
          const selected = value === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={selected}
              aria-label={config.label}
              onClick={() => onChange(code)}
              className={cn(
                "flex min-h-11 w-20 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors",
                selected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-6" aria-hidden="true" />
              <span className="text-xs leading-tight font-medium">{config.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <Select value={value ?? ""} onValueChange={(next) => onChange(next as ProductUnit)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={productLabels.unitPlaceholder}>
              {(selectedValue: string) => {
                const config = PRODUCT_UNIT_CONFIG[selectedValue as ProductUnit];
                if (!config) return productLabels.unitPlaceholder;
                const Icon = PRODUCT_UNIT_ICONS[config.icon];
                return (
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden="true" />
                    {config.label}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_UNIT_CODES.map((code) => {
              const config = PRODUCT_UNIT_CONFIG[code];
              const Icon = PRODUCT_UNIT_ICONS[config.icon];
              return (
                <SelectItem key={code} value={code}>
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden="true" />
                    {config.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
