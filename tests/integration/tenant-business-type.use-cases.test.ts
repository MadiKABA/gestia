import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaTenantRepository } from "@/infrastructure/tenant/tenant.repository";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { getTenantBusinessType } from "@/application/tenant/get-tenant-business-type.use-case";
import { updateBusinessType } from "@/application/tenant/update-business-type.use-case";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { DEFAULT_BUSINESS_TYPE } from "@/domain/tenant/business-type";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases de lecture/écriture du type de commerce — `businessType` vit sur
 * `Tenant`, pas `TenantSettings` (voir tenant-settings.use-cases.test.ts pour
 * le reste des paramètres).
 */
describe("use cases business-type", () => {
  const authRepository = new PrismaAuthRepository();
  const hasher = new Argon2Hasher();
  const auditLogger = new PrismaAuditLogger();
  const createdTenantIds: string[] = [];

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function registerTenant() {
    const phone = `+22177${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
    const otpCode = "123456";
    await prisma.otpCode.create({
      data: {
        identifier: phone,
        channel: "PHONE",
        purpose: "REGISTRATION",
        codeHash: await hasher.hash(otpCode),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const patron = await confirmRegistration(
      { repository: authRepository, hasher, auditLogger },
      {
        phone,
        otp: otpCode,
        pin: "1234",
        tenantName: "Boutique Test",
        patronName: "Awa Ndiaye",
        businessType: DEFAULT_BUSINESS_TYPE,
      },
    );
    createdTenantIds.push(patron.tenantId);
    return patron;
  }

  describe("getTenantBusinessType", () => {
    it("refuse la lecture si l'appelant n'est pas PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);

      await expect(
        getTenantBusinessType(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          { repository },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("renvoie ALIMENTATION_GENERALE par défaut à l'inscription", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);

      const businessType = await getTenantBusinessType(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository },
      );
      expect(businessType).toBe("ALIMENTATION_GENERALE");
    });
  });

  describe("updateBusinessType", () => {
    it("refuse la modification si l'appelant n'est pas PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);

      await expect(
        updateBusinessType(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          { repository, auditLogger },
          "BOUCHERIE",
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejette une valeur hors de la liste fermée", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);

      await expect(
        updateBusinessType(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          // `as never` : simule une valeur qui a contourné le typage statique.
          "RESTAURANT" as never,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("persiste le type de commerce sélectionné (round-trip Postgres)", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);
      const context = { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" as const };

      await updateBusinessType(context, { repository, auditLogger }, "BOUCHERIE");

      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: patron.tenantId } });
      expect(tenant.businessType).toBe("BOUCHERIE");
    });

    it("écrit une entrée AuditLog tenant.business_type_updated", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantRepository(patron.tenantId);

      await updateBusinessType(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository, auditLogger },
        "SALON_COIFFURE",
      );

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: patron.tenantId, action: "tenant.business_type_updated" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].entity).toBe("Tenant");
      expect(logs[0].entityId).toBe(patron.tenantId);
    });
  });
});
