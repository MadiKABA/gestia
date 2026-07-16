/**
 * Devises supportées (`TenantSettings.currency`) — seules valeurs acceptées
 * par `validateTenantSettingsInput` (domain/tenant-settings), jamais de
 * saisie libre : même principe que `BRAND_PRESET_VALUES` pour `brandColor`
 * (config/brand-presets.ts). Ce n'est pas un système de conversion entre
 * devises : chaque tenant reste isolé sur la sienne, seul l'affichage change.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "FCFA", label: "Franc CFA (FCFA)" },
  { code: "GNF", label: "Franc guinéen (GNF)" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "FCFA";

/** Tuple (pas juste `CurrencyCode[]`) pour être directement utilisable par
 * `z.enum(...)` (presentation/tenant/schemas.ts). */
export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

const CURRENCY_CODE_SET: ReadonlySet<string> = new Set(
  SUPPORTED_CURRENCIES.map((currency) => currency.code),
);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCY_CODE_SET.has(value);
}

export const CURRENCY_LABEL: Record<CurrencyCode, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency.label]),
) as Record<CurrencyCode, string>;
