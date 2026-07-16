import { transactionLabels } from "@/presentation/shared/labels";
import { formatAmount } from "@/presentation/shared/format-amount";
import type { CurrencyCode } from "@/config/currencies";

/**
 * Bandeau résumé "On me doit" / "Je dois" — mêmes termes exacts que
 * l'étape "situation" du wizard de création (cf. CLAUDE.md "Vocabulaire"),
 * jamais reformulés différemment ici. Partagé par la liste des opérations
 * et le dashboard patron : un seul composant pour que l'apparence (couleurs)
 * reste identique partout où ce résumé est affiché. Ne pose pas sa propre
 * grille (chaque appelant l'insère dans la sienne — 2 colonnes dédiées sur
 * /transactions, 2 des 4 cases du dashboard) : les deux cartes sont rendues
 * comme des enfants directs, jamais imbriquées dans une grille secondaire.
 */
export function BalanceSummaryCards({
  owedToMe,
  owedByMe,
  currency,
}: {
  owedToMe: number;
  owedByMe: number;
  currency: CurrencyCode;
}) {
  return (
    <>
      <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
        <p className="text-muted-foreground text-sm">
          <span aria-hidden>🤝</span> {transactionLabels.owedToMeLabel}
        </p>
        <p className="mt-1 text-xl font-semibold text-[#1B7A5A] tabular-nums">
          {formatAmount(owedToMe, currency)}
        </p>
      </div>
      <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
        <p className="text-muted-foreground text-sm">
          <span aria-hidden>🚚</span> {transactionLabels.owedByMeLabel}
        </p>
        <p className="mt-1 text-xl font-semibold text-[#0F2A4A] tabular-nums">
          {formatAmount(owedByMe, currency)}
        </p>
      </div>
    </>
  );
}
