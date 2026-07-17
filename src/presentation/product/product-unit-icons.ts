import {
  Box,
  Copy,
  Cylinder,
  Droplet,
  Grid3x3,
  Layers,
  Package,
  Package2,
  PackageOpen,
  Ruler,
  Scale,
  ShoppingBag,
  Wine,
  CircleQuestionMark,
  type LucideIcon,
} from "lucide-react";

/** Résout le nom d'icône (string) de `PRODUCT_UNIT_CONFIG`
 * (domain/product/product-unit.ts) vers le composant lucide-react réel —
 * même rôle que `BUSINESS_TYPE_ICONS` (business-type-selector.tsx). */
export const PRODUCT_UNIT_ICONS: Record<string, LucideIcon> = {
  package: Package,
  scale: Scale,
  droplet: Droplet,
  "shopping-bag": ShoppingBag,
  box: Box,
  "grid-3x3": Grid3x3,
  ruler: Ruler,
  "package-2": Package2,
  "package-open": PackageOpen,
  wine: Wine,
  cylinder: Cylinder,
  copy: Copy,
  layers: Layers,
  "circle-question-mark": CircleQuestionMark,
};
