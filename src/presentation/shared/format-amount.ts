import type { CurrencyCode } from "@/config/currencies";

/** Point d'entrée unique de formatage des montants — remplace tout usage
 * dispersé de `X.toLocaleString("fr-FR")} FCFA` (voir git history). Le
 * montant reste stocké en `Decimal` en base ; seul l'affichage dépend de la
 * devise du tenant. */
export function formatAmount(amount: number, currency: CurrencyCode): string {
  return `${amount.toLocaleString("fr-FR")} ${currency}`;
}
