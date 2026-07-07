import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";

/** Cards placeholder — contenu réel branché plus tard sur les vraies données
 * (solde caisse, créances/dettes, échéances). Identique PATRON/VENDEUR pour
 * l'instant ; `role` est déjà disponible ici pour différencier plus tard. */
const PLACEHOLDER_CARDS = ["Solde caisse", "À recevoir", "À payer", "Échéances proches"] as const;

export default async function DashboardPage() {
  try {
    await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
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
  );
}
