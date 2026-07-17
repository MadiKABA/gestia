"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { requirePatron } from "@/presentation/auth/require-role";
import { ValidationError } from "@/domain/shared/errors";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { PrismaTenantRepository } from "@/infrastructure/tenant/tenant.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { CloudinaryLogoUploader } from "@/infrastructure/external/cloudinary-client";
import { getTenantBranding } from "@/application/tenant/get-tenant-branding.use-case";
import { getTenantWhatsappTemplate } from "@/application/tenant/get-tenant-whatsapp-template.use-case";
import { getTenantWhatsappReceiptTemplates } from "@/application/tenant/get-tenant-whatsapp-receipt-templates.use-case";
import { getTenantReminderDays } from "@/application/tenant/get-tenant-reminder-days.use-case";
import { getTenantSettingsForEdit } from "@/application/tenant/get-tenant-settings-for-edit.use-case";
import { updateTenantSettings } from "@/application/tenant/update-tenant-settings.use-case";
import { uploadTenantLogo } from "@/application/tenant/upload-tenant-logo.use-case";
import { getTenantBusinessType } from "@/application/tenant/get-tenant-business-type.use-case";
import { updateBusinessType } from "@/application/tenant/update-business-type.use-case";
import {
  updateTenantSettingsSchema,
  updateBusinessTypeSchema,
  type UpdateTenantSettingsInput,
  type UpdateBusinessTypeInput,
} from "@/presentation/tenant/schemas";

// Stateless (aucun tenantId en constructeur) : singletons module-level
// légitimes, contrairement à PrismaTenantSettingsRepository/PrismaTenantRepository
// ci-dessous qui doivent être instanciés dans chaque action une fois le
// tenantId du context connu.
const auditLogger = new PrismaAuditLogger();
const logoUploader = new CloudinaryLogoUploader();

export async function getTenantBrandingAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantBranding(context, { repository });
}

export async function getTenantWhatsappTemplateAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantWhatsappTemplate({ repository });
}

export async function getTenantWhatsappReceiptTemplatesAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantWhatsappReceiptTemplates({ repository });
}

export async function getTenantReminderDaysAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantReminderDays({ repository });
}

export async function getTenantSettingsForEditAction() {
  const context = await requirePatron();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantSettingsForEdit(context, { repository });
}

export async function updateTenantSettingsAction(input: UpdateTenantSettingsInput) {
  const context = await requirePatron();
  const parsed = updateTenantSettingsSchema.parse(input);
  const repository = new PrismaTenantSettingsRepository(context.tenantId);

  const updated = await updateTenantSettings(context, { repository, auditLogger }, parsed);

  revalidatePath("/parametres");
  // La sidebar/le header lisent le branding un niveau au-dessus de la page
  // (voir app/(dashboard)/layout.tsx) : sans "layout", ils resteraient
  // périmés après une sauvegarde tant qu'on ne navigue pas hors du dashboard.
  revalidatePath("/", "layout");
  return updated;
}

export async function getTenantBusinessTypeAction() {
  const context = await requirePatron();
  const repository = new PrismaTenantRepository(context.tenantId);
  return getTenantBusinessType(context, { repository });
}

export async function updateBusinessTypeAction(input: UpdateBusinessTypeInput) {
  const context = await requirePatron();
  const { businessType } = updateBusinessTypeSchema.parse(input);
  const repository = new PrismaTenantRepository(context.tenantId);

  const updated = await updateBusinessType(context, { repository, auditLogger }, businessType);

  revalidatePath("/parametres");
  return updated;
}

export async function uploadTenantLogoAction(formData: FormData) {
  const context = await requirePatron();
  const file = formData.get("logo");
  if (!(file instanceof File)) {
    throw new ValidationError("Aucun fichier reçu");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const repository = new PrismaTenantSettingsRepository(context.tenantId);

  const updated = await uploadTenantLogo(
    context,
    { logoUploader, repository, auditLogger },
    { buffer, mimeType: file.type, sizeBytes: file.size },
  );

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return updated;
}
