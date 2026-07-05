import type { AuditLogEntry, AuditLogger } from "@/application/shared/audit-logger";
import type { TenantContext } from "@/domain/shared/tenant-context";
import { prisma } from "@/infrastructure/prisma/client";

/**
 * Pas de TenantScopedRepository ici : `log()` reçoit son tenantId via le
 * `context` de chaque appel (service partagé, pas instancié par requête), et
 * une création n'a pas de clause `where` à sécuriser.
 */
export class PrismaAuditLogger implements AuditLogger {
  async log(context: TenantContext, entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        oldData: entry.oldData === undefined ? undefined : (entry.oldData as object),
        newData: entry.newData === undefined ? undefined : (entry.newData as object),
      },
    });
  }
}
