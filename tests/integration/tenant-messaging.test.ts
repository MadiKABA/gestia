import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { getTenantWhatsappTemplate } from "@/application/tenant/get-tenant-whatsapp-template.use-case";

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
