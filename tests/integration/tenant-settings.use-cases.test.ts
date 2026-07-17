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
import { DEFAULT_BUSINESS_TYPE } from "@/domain/tenant/business-type";

/** En-tête PNG réel (magic bytes) — depuis la validation par contenu réel du
 * fichier (logo-file.ts), un buffer de texte arbitraire ne passe plus la
 * vérification, même avec un mimeType "image/png" déclaré. */
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
    const phone = `+22176${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
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

    it("persiste la devise sélectionnée (round-trip Postgres, FCFA -> GNF)", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);
      const context = { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" as const };

      const beforeUpdate = await repository.findFull();
      expect(beforeUpdate?.currency).toBe("FCFA");

      await updateTenantSettings(context, { repository, auditLogger }, { currency: "GNF" });

      const afterUpdate = await repository.findFull();
      expect(afterUpdate?.currency).toBe("GNF");
    });

    it("rejette une devise hors de la liste fermée (FCFA, GNF)", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          // `as never` : simule une valeur qui a contourné le typage statique
          // (ex. payload externe non typé) — la validation domaine doit
          // rester la dernière ligne de défense.
          { currency: "USD" as never },
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

    it("rejette whatsappReceiptPartialTemplate sans les placeholders attendus", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          { whatsappReceiptPartialTemplate: "Message sans placeholders" },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("rejette whatsappReceiptFinalTemplate sans les placeholders attendus", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);

      await expect(
        updateTenantSettings(
          { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
          { repository, auditLogger },
          { whatsappReceiptFinalTemplate: "Message sans placeholders" },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("persiste les gabarits de reçu WhatsApp (round-trip Postgres)", async () => {
      const patron = await registerTenant();
      const repository = new PrismaTenantSettingsRepository(patron.tenantId);
      const context = { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" as const };

      await updateTenantSettings(
        context,
        { repository, auditLogger },
        {
          whatsappReceiptPartialTemplate:
            "Salam {client}, paiement {montantPaye} par {modePaiement}, reste {montantRestant} FCFA",
          whatsappReceiptFinalTemplate: "Salam {client}, merci pour {montantPaye} FCFA. Safi !",
        },
      );

      const settings = await repository.findFull();
      expect(settings?.whatsappReceiptPartialTemplate).toBe(
        "Salam {client}, paiement {montantPaye} par {modePaiement}, reste {montantRestant} FCFA",
      );
      expect(settings?.whatsappReceiptFinalTemplate).toBe(
        "Salam {client}, merci pour {montantPaye} FCFA. Safi !",
      );
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
      expect(settings.whatsappReceiptPartialTemplate).toBeNull();
      expect(settings.whatsappReceiptFinalTemplate).toBeNull();
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

    it("rejette un mimeType falsifié dont le contenu réel n'est pas une image (régression contournement upload)", async () => {
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
          // mimeType déclaré "image/png" mais contenu réel arbitraire — un
          // simple .type falsifiable côté client ne suffit plus à passer.
          {
            buffer: Buffer.from("#!/bin/sh\necho not an image"),
            mimeType: "image/png",
            sizeBytes: 100,
          },
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
        { buffer: PNG_BUFFER, mimeType: "image/png", sizeBytes: 100 },
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
          { buffer: PNG_BUFFER, mimeType: "image/png", sizeBytes: 100 },
        ),
      ).rejects.toThrow("Panne Cloudinary");
    });
  });
});
