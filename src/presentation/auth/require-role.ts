import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/** Garde d'accès pour les Server Actions/pages réservées au patron (invitation
 * et désactivation de vendeurs, theming, etc. — cahier des charges §2). */
export async function requirePatron(): Promise<TenantContext> {
  const context = await requireTenantContext();
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }
  return context;
}
