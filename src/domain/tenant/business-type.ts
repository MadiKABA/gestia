/**
 * Types de commerce supportés (`Tenant.businessType`) — liste fermée, même
 * principe que `SUPPORTED_CURRENCIES` (config/currencies.ts) et
 * `BRAND_PRESET_VALUES` (config/brand-presets.ts) : jamais de saisie libre.
 *
 * `icon` est le nom (kebab-case) de l'icône `lucide-react` associée — une
 * simple donnée, jamais le composant lui-même : le domaine reste pur, sans
 * dépendance UI (voir ARCHITECTURE.md "Rôle de chaque couche"). La
 * résolution vers le composant réel se fait côté presentation
 * (`src/presentation/shared/components/business-type-selector.tsx`).
 */
export const BUSINESS_TYPE_CATEGORIES = ["PRODUIT", "SERVICE"] as const;
export type BusinessTypeCategory = (typeof BUSINESS_TYPE_CATEGORIES)[number];

export const SUPPORTED_BUSINESS_TYPES = [
  {
    code: "ALIMENTATION_GENERALE",
    label: "Alimentation générale",
    icon: "shopping-basket",
    category: "PRODUIT",
  },
  {
    code: "QUINCAILLERIE",
    label: "Quincaillerie",
    icon: "hammer",
    category: "PRODUIT",
  },
  {
    code: "BOUCHERIE",
    label: "Boucherie",
    icon: "beef",
    category: "PRODUIT",
  },
  {
    code: "PRESSING",
    label: "Pressing",
    icon: "washing-machine",
    category: "SERVICE",
  },
  {
    code: "VETEMENT",
    label: "Vêtement",
    icon: "shirt",
    category: "PRODUIT",
  },
  {
    code: "TELEPHONE_ACCESSOIRES",
    label: "Téléphone & accessoires",
    icon: "smartphone",
    category: "PRODUIT",
  },
  {
    code: "ELECTROMENAGER",
    label: "Électroménager",
    icon: "refrigerator",
    category: "PRODUIT",
  },
  {
    code: "COSMETIQUE",
    label: "Cosmétique",
    icon: "sparkles",
    category: "PRODUIT",
  },
  {
    code: "SALON_COIFFURE",
    label: "Salon de coiffure",
    icon: "scissors",
    category: "SERVICE",
  },
  {
    code: "AUTRE",
    label: "Autre",
    icon: "store",
    category: "PRODUIT",
  },
] as const satisfies ReadonlyArray<{
  code: string;
  label: string;
  icon: string;
  category: BusinessTypeCategory;
}>;

export type BusinessTypeCode = (typeof SUPPORTED_BUSINESS_TYPES)[number]["code"];
export type BusinessTypeIconName = (typeof SUPPORTED_BUSINESS_TYPES)[number]["icon"];

export const DEFAULT_BUSINESS_TYPE: BusinessTypeCode = "ALIMENTATION_GENERALE";

/** Tuple (pas juste `BusinessTypeCode[]`) pour être directement utilisable
 * par `z.enum(...)` (presentation/auth/schemas.ts, presentation/tenant/schemas.ts). */
export const BUSINESS_TYPE_CODES = SUPPORTED_BUSINESS_TYPES.map(
  (businessType) => businessType.code,
) as [BusinessTypeCode, ...BusinessTypeCode[]];

const BUSINESS_TYPE_CODE_SET: ReadonlySet<string> = new Set(
  SUPPORTED_BUSINESS_TYPES.map((businessType) => businessType.code),
);

export function isBusinessTypeCode(value: string): value is BusinessTypeCode {
  return BUSINESS_TYPE_CODE_SET.has(value);
}

export const BUSINESS_TYPE_CONFIG: Record<
  BusinessTypeCode,
  { label: string; icon: BusinessTypeIconName; category: BusinessTypeCategory }
> = Object.fromEntries(
  SUPPORTED_BUSINESS_TYPES.map((businessType) => [
    businessType.code,
    { label: businessType.label, icon: businessType.icon, category: businessType.category },
  ]),
) as Record<
  BusinessTypeCode,
  { label: string; icon: BusinessTypeIconName; category: BusinessTypeCategory }
>;
