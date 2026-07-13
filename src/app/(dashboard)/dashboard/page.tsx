import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { ForbiddenError } from "@/domain/shared/errors";
import { getTransactionBalanceSummaryAction } from "@/presentation/transaction/actions";
import { BalanceSummaryCards } from "@/presentation/transaction/components/balance-summary-cards";

/** "Solde caisse"/"Échéances proches" restent en attente de données réelles
 * (modules Caisse et échéances hors périmètre de ce retrofit) — seules
 * "On me doit"/"Je dois" sont câblées, dérivées du module Transaction déjà
 * en place. Réservé au patron : jamais de trésorerie globale pour un
 * vendeur (cf. CLAUDE.md "Rôles"). */
const PLACEHOLDER_CARDS = ["Solde caisse", "Échéances proches"] as const;

export default async function DashboardPage() {
  try {
    await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      // Effet de bord du correctif "/" → /dashboard pour une session valide
      // (voir app/page.tsx) : rediriger un VENDEUR vers "/" créerait une
      // boucle infinie (/ renvoie vers /dashboard, qui le renvoie ici vers
      // /). "/tiers" est la première route accessible aux deux rôles dans
      // SIDEBAR_NAV_ITEMS et sa page existe déjà, contrairement à
      // "/mes-operations" (pas encore construite, voir nav-config.ts).
      redirect("/tiers");
    }
    throw error;
  }

  const summary = await getTransactionBalanceSummaryAction();

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceSummaryCards owedToMe={summary.owedToMe} owedByMe={summary.owedByMe} />
        {PLACEHOLDER_CARDS.map((title) => (
          <div
            key={title}
            className="border-border bg-card space-y-2 rounded-xl border p-4 shadow-xs"
          >
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="text-foreground text-2xl font-semibold">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
