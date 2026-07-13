/** Date en toutes lettres pour les messages WhatsApp ("12 juillet 2026") —
 * distinct du format court `toLocaleDateString("fr-FR")` utilisé pour les
 * dates affichées dans l'UI (échéances, historique), volontairement plus
 * lisible dans une phrase adressée au client. */
export function formatLongDateFr(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
