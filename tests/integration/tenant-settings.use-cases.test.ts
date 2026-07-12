import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { updateTenantSettings } from "@/application/tenant/update-tenant-settings.use-case";
import { getTenantSettingsForEdit } from "@/application/tenant/get-tenant-settings-for-edit.use-case";
import { uploadTenantLogo } from "@/application/tenant/upload-tenant-logo.use-case";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases d'écriture des paramètres tenant.
 */
describe("use cases tenant-settings", () => {
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
    const phone = `+22176${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`;
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
      { phone, otp: otpCode, pin: "1234", tenantName: "Boutique Test", patronName: "Awa Ndiaye" },
    );
    createdTenantIds.push(patron.tenantId);
    return patron;
  }

  describe("updateTenantSettings", () => {
    it("refuse la modification si l'appelant n'est pas PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          { repository, auditLogger },
          { displayName: "Nouvelle boutique" },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejette reminderDays hors plage", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          { reminderDays: 60 },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("rejette brandColor hors des presets", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          { brandColor: "#123456" },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("rejette whatsappTemplate sans les placeholders attendus", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          { whatsappTemplate: "Message sans placeholders" },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("persiste un update partiel sans toucher aux champs non envoyés", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);
      const context = { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" as const };

      await updateTenantSettings(context, { repository, auditLogger }, { reminderDays: 15 });
      const afterFirstUpdate = await repository.findFull();
      expect(afterFirstUpdate?.reminderDays).toBe(15);
      expect(afterFirstUpdate?.brandColor).toBe("#0F2A4A");

      await updateTenantSettings(
        context,
        { repository, auditLogger },
        { displayName: "Ma Boutique" },
      );
      const afterSecondUpdate = await repository.findFull();
      expect(afterSecondUpdate?.displayName).toBe("Ma Boutique");
      // reminderDays reste à la valeur posée par le premier update, non
      // écrasé par le second (undefined = "ne pas toucher" côté Prisma).
      expect(afterSecondUpdate?.reminderDays).toBe(15);
    });

    it("écrit une entrée AuditLog tenant-settings.updated", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await updateTenantSettings(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository, auditLogger },
        { displayName: "Boutique Awa" },
      );

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: patron.tenantId, action: "tenant-settings.updated" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].entity).toBe("TenantSettings");
      expect(logs[0].entityId).toBe(patron.tenantId);
    });
  });

  describe("getTenantSettingsForEdit", () => {
    it("refuse la lecture si l'appelant n'est pas PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        getTenantSettingsForEdit(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          { repository },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("renvoie l'objet complet pour un PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      const settings = await getTenantSettingsForEdit(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository },
      );
      expect(settings.currency).toBe("FCFA");
      expect(settings.brandColor).toBe("#0F2A4A");
    });
  });

  describe("uploadTenantLogo", () => {
    it("refuse l'upload si l'appelant n'est pas PATRON", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        uploadTenantLogo(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          {
            logoUploader: { upload: async () => ({ url: "https://example.test/logo.png" }) },
            repository,
            auditLogger,
          },
          { buffer: Buffer.from(""), mimeType: "image/png", sizeBytes: 100 },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejette un fichier invalide sans appeler l'uploader", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);
      let called = false;

      await expect(
        uploadTenantLogo(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          {
            logoUploader: {
              upload: async () => {
                called = true;
                return { url: "https://example.test/logo.png" };
              },
            },
            repository,
            auditLogger,
          },
          { buffer: Buffer.from(""), mimeType: "image/gif", sizeBytes: 100 },
        ),
      ).rejects.toThrow(ValidationError);
      expect(called).toBe(false);
    });

    it("persiste logoUrl et écrit l'AuditLog quand l'upload réussit", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      const result = await uploadTenantLogo(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        {
          logoUploader: { upload: async () => ({ url: "https://res.cloudinary.com/logo.png" }) },
          repository,
          auditLogger,
        },
        { buffer: Buffer.from("fake-image"), mimeType: "image/png", sizeBytes: 100 },
      );

      expect(result.logoUrl).toBe("https://res.cloudinary.com/logo.png");
      const logs = await prisma.auditLog.findMany({
        where: { tenantId: patron.tenantId, action: "tenant-settings.updated" },
      });
      expect(logs).toHaveLength(1);
    });

    it("propage une erreur claire si l'upload échoue (panne fournisseur)", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        uploadTenantLogo(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          {
            logoUploader: {
              upload: async () => {
                throw new Error("Panne Cloudinary");
              },
            },
            repository,
            auditLogger,
          },
          { buffer: Buffer.from("fake-image"), mimeType: "image/png", sizeBytes: 100 },
        ),
      ).rejects.toThrow("Panne Cloudinary");
    });
  });
});
