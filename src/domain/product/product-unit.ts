import { PRODUCT_UNIT_CODES, type ProductUnit } from "@/domain/product/product.entity";

/**
 * Libellé + icône de chaque unité de mesure — même principe que
 * `BUSINESS_TYPE_CONFIG` (domain/tenant/business-type.ts) : `icon` est un nom
 * `lucide-react` (kebab-case), une simple donnée, jamais le composant
 * lui-même — le domaine reste pur, sans dépendance UI. La résolution vers le
 * composant réel se fait côté presentation
 * (`src/presentation/product/product-unit-icons.ts`).
 *
 * Icônes vérifiées une à une dans la version installée (lucide-react 1.23) :
 * `HelpCircle` n'existe plus dans cette version (renommée), remplacée par
 * `circle-question-mark` (`CircleQuestionMark`).
 */
export const PRODUCT_UNIT_CONFIG: Record<ProductUnit, { label: string; icon: string }> = {
  PIECE: { label: "Pièce", icon: "package" },
  KILOGRAMME: { label: "Kilogramme", icon: "scale" },
  GRAMME: { label: "Gramme", icon: "scale" },
  LITRE: { label: "Litre", icon: "droplet" },
  MILLILITRE: { label: "Millilitre", icon: "droplet" },
  SAC: { label: "Sac", icon: "shopping-bag" },
  CARTON: { label: "Carton", icon: "box" },
  DOUZAINE: { label: "Douzaine", icon: "grid-3x3" },
  METRE: { label: "Mètre", icon: "ruler" },
  PAQUET: { label: "Paquet", icon: "package-2" },
  BOITE: { label: "Boîte", icon: "package-open" },
  BOUTEILLE: { label: "Bouteille", icon: "wine" },
  SACHET: { label: "Sachet", icon: "shopping-bag" },
  ROULEAU: { label: "Rouleau", icon: "cylinder" },
  PAIRE: { label: "Paire", icon: "copy" },
  LOT: { label: "Lot", icon: "layers" },
  AUTRE: { label: "Autre", icon: "circle-question-mark" },
};

export { PRODUCT_UNIT_CODES };
export type { ProductUnit };
