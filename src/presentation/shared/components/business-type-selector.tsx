"use client";

import {
  Beef,
  Hammer,
  Refrigerator,
  Scissors,
  Shirt,
  Smartphone,
  Sparkles,
  ShoppingBasket,
  Store,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUSINESS_TYPE_CODES,
  BUSINESS_TYPE_CONFIG,
  type BusinessTypeCode,
  type BusinessTypeIconName,
} from "@/domain/tenant/business-type";

const BUSINESS_TYPE_ICONS: Record<BusinessTypeIconName, LucideIcon> = {
  "shopping-basket": ShoppingBasket,
  hammer: Hammer,
  beef: Beef,
  "washing-machine": WashingMachine,
  shirt: Shirt,
  smartphone: Smartphone,
  refrigerator: Refrigerator,
  sparkles: Sparkles,
  scissors: Scissors,
  store: Store,
};

/**
 * Carrousel tactile (< lg) / grille (≥ lg), même composant contrôlé utilisé
 * à l'inscription et dans Paramètres → Général : c'est l'appelant qui décide
 * de la sauvegarde (soumission de formulaire ou action immédiate). Sélection
 * = bordure accentuée + `aria-pressed`, même pattern que `BrandColorPicker`.
 * Pas de padding de zone sûre ici : le composant vit toujours dans le
 * contenu scrollable d'une page déjà contenue par `AppShell`, qui applique
 * `env(safe-area-inset-*)` au niveau du layout.
 */
export function BusinessTypeSelector({
  value,
  onChange,
  disabled,
  label = "Type de commerce",
  className,
}: {
  value: BusinessTypeCode;
  onChange: (value: BusinessTypeCode) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
        "lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:pb-0 xl:grid-cols-4",
        className,
      )}
    >
      {BUSINESS_TYPE_CODES.map((code) => {
        const config = BUSINESS_TYPE_CONFIG[code];
        const Icon = BUSINESS_TYPE_ICONS[config.icon];
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            aria-label={config.label}
            disabled={disabled}
            onClick={() => onChange(code)}
            className={cn(
              "flex min-h-11 w-24 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors",
              "lg:w-auto",
              selected
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
            <span className="text-xs leading-tight font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
