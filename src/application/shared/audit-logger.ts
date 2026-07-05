import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Toute mutation métier (create/update/annulation) doit écrire une entrée
 * AuditLog — jamais de suppression définitive (cahier des charges §7).
 * Interface implémentée par src/infrastructure/audit-log/audit-log.repository.ts.
 */
export type AuditLogEntry = {
  action: string;
  entity: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
};

export interface AuditLogger {
  log(context: TenantContext, entry: AuditLogEntry): Promise<void>;
}
