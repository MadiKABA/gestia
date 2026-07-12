import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { getTenantWhatsappTemplate } from "@/application/tenant/get-tenant-whatsapp-template.use-case";
import { getTenantWhatsappReceiptTemplates } from "@/application/tenant/get-tenant-whatsapp-receipt-templates.use-case";
import { getTenantReminderDays } from "@/application/tenant/get-tenant-reminder-days.use-case";

describe("getTenantWhatsappTemplate", () => {
  const tenantId = "test-tenant-messaging";

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("retourne null si le tenant n'a jamais personnalisé son gabarit", async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant messaging" } });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantWhatsappTemplate({ repository })).resolves.toBeNull();
  });

  it("retourne le gabarit personnalisé du tenant une fois renseigné", async () => {
    await prisma.tenantSettings.create({
      data: { tenantId, whatsappTemplate: "Salut {client}, pense à régler {reference} !" },
    });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantWhatsappTemplate({ repository })).resolves.toBe(
      "Salut {client}, pense à régler {reference} !",
    );
  });
});

describe("getTenantWhatsappReceiptTemplates", () => {
  const tenantId = "test-tenant-messaging-receipts";

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("retourne partial et final à null si le tenant n'a jamais personnalisé ses gabarits", async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant messaging receipts" } });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantWhatsappReceiptTemplates({ repository })).resolves.toEqual({
      partial: null,
      final: null,
    });
  });

  it("retourne les gabarits personnalisés du tenant une fois renseignés", async () => {
    await prisma.tenantSettings.create({
      data: {
        tenantId,
        whatsappReceiptPartialTemplate: "Merci {client}, reste {montantRestant} FCFA",
        whatsappReceiptFinalTemplate: "Merci {client}, Safi !",
      },
    });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantWhatsappReceiptTemplates({ repository })).resolves.toEqual({
      partial: "Merci {client}, reste {montantRestant} FCFA",
      final: "Merci {client}, Safi !",
    });
  });
});

describe("getTenantReminderDays", () => {
  const tenantId = "test-tenant-messaging-reminder";

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("retourne 7 par défaut si le tenant n'a jamais personnalisé ce réglage", async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant messaging reminder" } });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantReminderDays({ repository })).resolves.toBe(7);
  });

  it("retourne la valeur personnalisée du tenant une fois renseignée", async () => {
    await prisma.tenantSettings.create({
      data: { tenantId, reminderDays: 3 },
    });
    const repository = new PrismaTenantSettingsRepository(tenantId);

    await expect(getTenantReminderDays({ repository })).resolves.toBe(3);
  });
});
