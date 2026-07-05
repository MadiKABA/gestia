import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { login } from "@/application/auth/login.use-case";
import { inviteVendeur } from "@/application/auth/invite-vendeur.use-case";
import { deactivateVendeur } from "@/application/auth/deactivate-vendeur.use-case";
import { MAX_FAILED_ATTEMPTS } from "@/domain/auth/pin-policy";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases critiques de l'authentification téléphone + PIN.
 */
describe("use cases auth", () => {
  const repository = new PrismaAuthRepository();
  const hasher = new Argon2Hasher();
  const auditLogger = new PrismaAuditLogger();
  const createdTenantIds: string[] = [];

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function registerTenant(phone: string) {
    const otpCode = "123456";
    await prisma.otpCode.create({
      data: {
        phone,
        purpose: "REGISTRATION",
        codeHash: await hasher.hash(otpCode),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const patron = await confirmRegistration(
      { repository, hasher, auditLogger },
      { phone, otp: otpCode, pin: "1234", tenantName: "Boutique Test", patronName: "Awa Ndiaye" },
    );
    createdTenantIds.push(patron.tenantId);
    return patron;
  }

  describe("confirmRegistration", () => {
    it("crée le Tenant, le patron et les TenantSettings par défaut en une transaction", async () => {
      const phone = `+22177${Date.now().toString().slice(-7)}`;
      const patron = await registerTenant(phone);

      const tenant = await prisma.tenant.findUnique({
        where: { id: patron.tenantId },
        include: { settings: true, users: true },
      });

      expect(tenant?.users).toHaveLength(1);
      expect(tenant?.users[0].role).toBe("PATRON");
      expect(tenant?.settings?.currency).toBe("FCFA");
      expect(tenant?.settings?.brandColor).toBe("#0F2A4A");
      expect(tenant?.settings?.reminderDays).toBe(7);
    });

    it("rejette un OTP invalide ou expiré", async () => {
      const phone = `+22177${Date.now().toString().slice(-6)}1`;
      await prisma.otpCode.create({
        data: {
          phone,
          purpose: "REGISTRATION",
          codeHash: await hasher.hash("123456"),
          expiresAt: new Date(Date.now() - 1),
        },
      });

      await expect(
        confirmRegistration(
          { repository, hasher, auditLogger },
          { phone, otp: "123456", pin: "1234", tenantName: "X", patronName: "Y" },
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("login", () => {
    it("réussit avec le bon PIN et journalise auth.login_success", async () => {
      const phone = `+22178${Date.now().toString().slice(-7)}`;
      const patron = await registerTenant(phone);

      const user = await login({ repository, hasher, auditLogger }, { phone, pin: "1234" });

      expect(user.id).toBe(patron.id);
      const logs = await prisma.auditLog.findMany({
        where: { entityId: patron.id, action: "auth.login_success" },
      });
      expect(logs).toHaveLength(1);
    });

    it("échoue avec un mauvais PIN et journalise auth.login_failed", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}1`;
      const patron = await registerTenant(phone);

      await expect(
        login({ repository, hasher, auditLogger }, { phone, pin: "0000" }),
      ).rejects.toThrow(ValidationError);

      const logs = await prisma.auditLog.findMany({
        where: { entityId: patron.id, action: "auth.login_failed" },
      });
      expect(logs).toHaveLength(1);
    });

    it("verrouille le compte après 5 échecs consécutifs", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}2`;
      const patron = await registerTenant(phone);

      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        await expect(
          login({ repository, hasher, auditLogger }, { phone, pin: "0000" }),
        ).rejects.toThrow(ValidationError);
      }

      await expect(
        login({ repository, hasher, auditLogger }, { phone, pin: "1234" }),
      ).rejects.toThrow(ForbiddenError);

      const user = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(user?.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
      expect(user?.lockedUntil).not.toBeNull();
    });

    it("réinitialise failedAttempts après une connexion réussie", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}3`;
      const patron = await registerTenant(phone);

      await expect(
        login({ repository, hasher, auditLogger }, { phone, pin: "0000" }),
      ).rejects.toThrow(ValidationError);

      await login({ repository, hasher, auditLogger }, { phone, pin: "1234" });

      const user = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(user?.failedAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    });
  });

  describe("inviteVendeur", () => {
    it("refuse l'invitation si l'appelant n'est pas PATRON", async () => {
      const phone = `+22179${Date.now().toString().slice(-7)}`;
      const patron = await registerTenant(phone);

      await expect(
        inviteVendeur(
          { tenantId: patron.tenantId, userId: patron.id, role: "VENDEUR" },
          { repository, otpSender: { sendOtp: async () => undefined }, hasher, auditLogger },
          { name: "Vendeur Test", phone: `+22179${Date.now().toString().slice(-6)}9` },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("crée le vendeur inactif côté PIN et envoie un OTP quand l'appelant est PATRON", async () => {
      const phone = `+22179${Date.now().toString().slice(-6)}1`;
      const patron = await registerTenant(phone);
      const vendeurPhone = `+22179${Date.now().toString().slice(-6)}2`;
      let sentTo: string | undefined;

      const vendeur = await inviteVendeur(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        {
          repository,
          otpSender: {
            sendOtp: async (to) => {
              sentTo = to;
            },
          },
          hasher,
          auditLogger,
        },
        { name: "Vendeur Test", phone: vendeurPhone },
      );

      expect(vendeur.role).toBe("VENDEUR");
      expect(vendeur.tenantId).toBe(patron.tenantId);
      expect(sentTo).toBe(vendeurPhone);
    });
  });

  describe("deactivateVendeur", () => {
    it("désactive un vendeur du même tenant quand l'appelant est PATRON", async () => {
      const phone = `+22170${Date.now().toString().slice(-6)}1`;
      const patron = await registerTenant(phone);
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: `+22170${Date.now().toString().slice(-6)}2`,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });

      await deactivateVendeur(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository, auditLogger },
        { vendeurId: vendeur.id },
      );

      const updated = await prisma.user.findUnique({ where: { id: vendeur.id } });
      expect(updated?.active).toBe(false);
    });

    it("refuse si l'appelant n'est pas PATRON", async () => {
      const phone = `+22170${Date.now().toString().slice(-6)}3`;
      const patron = await registerTenant(phone);
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: `+22170${Date.now().toString().slice(-6)}4`,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });

      await expect(
        deactivateVendeur(
          { tenantId: patron.tenantId, userId: vendeur.id, role: "VENDEUR" },
          { repository, auditLogger },
          { vendeurId: vendeur.id },
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
