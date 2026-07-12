import type { TenantContext } from "@/domain/shared/tenant-context";
import type { TenantSettingsUpdateInput } from "@/domain/tenant-settings/tenant-settings.entity";
import { validateTenantSettingsInput } from "@/domain/tenant-settings/tenant-settings.entity";
import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantSettingsRepository } from "@/application/tenant/tenant-settings.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function updateTenantSettings(
  context: TenantContext,
  deps: { repository: TenantSettingsRepository; auditLogger: AuditLogger },
  input: TenantSettingsUpdateInput,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut modifier les paramètres de la boutique");
  }

  validateTenantSettingsInput(input);

  const existing = await deps.repository.findFull();
  const updated = await deps.repository.update(input);

  // TenantSettings n'a pas d'id propre : son PK est tenantId lui-même.
  await deps.auditLogger.log(context, {
    action: "tenant-settings.updated",
    entity: "TenantSettings",
    entityId: context.tenantId,
    oldData: existing,
    newData: updated,
  });

  return updated;
}
