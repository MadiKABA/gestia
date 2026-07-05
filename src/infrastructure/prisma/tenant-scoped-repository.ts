import { prisma } from "@/infrastructure/prisma/client";

/**
 * Base commune à tous les repositories Prisma. Porte le tenantId courant et
 * expose `scoped()` pour l'injecter systématiquement dans les clauses `where` :
 * ça rend l'oubli du filtre tenantId impossible plutôt que simplement "à ne pas
 * oublier" (cahier des charges §7 — isolation stricte, centralisée).
 *
 * Aucun repository ne doit appeler `prisma` directement sans passer par `scoped()`
 * pour ses lectures/écritures propres au tenant.
 */
export abstract class TenantScopedRepository {
  protected readonly prisma = prisma;

  constructor(protected readonly tenantId: string) {}

  protected scoped<TWhere extends object>(where: TWhere = {} as TWhere) {
    return { ...where, tenantId: this.tenantId };
  }
}
