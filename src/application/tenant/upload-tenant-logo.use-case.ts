import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateLogoFile } from "@/domain/tenant-settings/logo-file";
import { ForbiddenError } from "@/domain/shared/errors";
import type { LogoUploader } from "@/application/tenant/logo-uploader";
import type { TenantSettingsRepository } from "@/application/tenant/tenant-settings.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";
import { updateTenantSettings } from "@/application/tenant/update-tenant-settings.use-case";

/** Délègue la persistance + l'entrée AuditLog à updateTenantSettings — jamais
 * de duplication de la logique d'écriture entre les deux use cases. */
export async function uploadTenantLogo(
  context: TenantContext,
  deps: {
    logoUploader: LogoUploader;
    repository: TenantSettingsRepository;
    auditLogger: AuditLogger;
  },
  file: { buffer: Buffer; mimeType: string; sizeBytes: number },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut modifier le logo de la boutique");
  }

  validateLogoFile({ mimeType: file.mimeType, sizeBytes: file.sizeBytes, content: file.buffer });

  const { url } = await deps.logoUploader.upload(file, context.tenantId);

  return updateTenantSettings(
    context,
    { repository: deps.repository, auditLogger: deps.auditLogger },
    { logoUrl: url },
  );
}
