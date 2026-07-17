import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { login } from "@/application/auth/login.use-case";
import { requestPinReset } from "@/application/auth/request-pin-reset.use-case";
import { confirmPinReset } from "@/application/auth/confirm-pin-reset.use-case";
import { inviteVendeur } from "@/application/auth/invite-vendeur.use-case";
import { deactivateVendeur } from "@/application/auth/deactivate-vendeur.use-case";
import { reactivateVendeur } from "@/application/auth/reactivate-vendeur.use-case";
import { updateVendeur } from "@/application/auth/update-vendeur.use-case";
import { MAX_FAILED_ATTEMPTS } from "@/domain/auth/pin-policy";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { DEFAULT_BUSINESS_TYPE } from "@/domain/tenant/business-type";

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

  async function registerTenant(phone: string, email?: string) {
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
      { repository, hasher, auditLogger },
      {
        phone,
        otp: otpCode,
        pin: "1234",
        tenantName: "Boutique Test",
        patronName: "Awa Ndiaye",
        email,
        businessType: DEFAULT_BUSINESS_TYPE,
      },
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
          identifier: phone,
          channel: "PHONE",
          purpose: "REGISTRATION",
          codeHash: await hasher.hash("123456"),
          expiresAt: new Date(Date.now() - 1),
        },
      });

      await expect(
        confirmRegistration(
          { repository, hasher, auditLogger },
          {
            phone,
            otp: "123456",
            pin: "1234",
            tenantName: "X",
            patronName: "Y",
            businessType: DEFAULT_BUSINESS_TYPE,
          },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("rejette un email déjà associé à un autre compte", async () => {
      const email = `awa${Date.now()}@gestia.test`;
      await registerTenant(`+22177${Date.now().toString().slice(-6)}5`, email);

      const otherPhone = `+22177${Date.now().toString().slice(-6)}6`;
      await prisma.otpCode.create({
        data: {
          identifier: otherPhone,
          channel: "PHONE",
          purpose: "REGISTRATION",
          codeHash: await hasher.hash("123456"),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(
        confirmRegistration(
          { repository, hasher, auditLogger },
          {
            phone: otherPhone,
            otp: "123456",
            pin: "1234",
            tenantName: "X",
            patronName: "Y",
            email,
            businessType: DEFAULT_BUSINESS_TYPE,
          },
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("login", () => {
    it("réussit avec le bon PIN et journalise auth.login_success", async () => {
      const phone = `+22178${Date.now().toString().slice(-7)}`;
      const patron = await registerTenant(phone);

      const user = await login(
        { repository, hasher, auditLogger },
        { channel: "PHONE", identifier: phone, pin: "1234" },
      );

      expect(user.id).toBe(patron.id);
      const logs = await prisma.auditLog.findMany({
        where: { entityId: patron.id, action: "auth.login_success" },
      });
      expect(logs).toHaveLength(1);
    });

    it("réussit avec l'email quand un email est renseigné", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}9`;
      const email = `awa${Date.now()}@gestia.test`;
      const patron = await registerTenant(phone, email);

      const user = await login(
        { repository, hasher, auditLogger },
        { channel: "EMAIL", identifier: email, pin: "1234" },
      );

      expect(user.id).toBe(patron.id);
    });

    it("échoue avec un mauvais PIN et journalise auth.login_failed", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}1`;
      const patron = await registerTenant(phone);

      await expect(
        login(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, pin: "0000" },
        ),
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
          login(
            { repository, hasher, auditLogger },
            { channel: "PHONE", identifier: phone, pin: "0000" },
          ),
        ).rejects.toThrow(ValidationError);
      }

      await expect(
        login(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, pin: "1234" },
        ),
      ).rejects.toThrow(ForbiddenError);

      const user = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(user?.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
      expect(user?.lockedUntil).not.toBeNull();
    });

    it("verrouille le compte même sous tentatives concurrentes (régression race condition)", async () => {
      // Reproduit le scénario de l'audit sécurité : 10 tentatives de login
      // concurrentes avec un mauvais PIN sur le même compte. Avant le fix
      // (read-then-write applicatif), toutes lisaient `failedAttempts=0`
      // avant qu'aucune n'écrive, produisant `failedAttempts=1` en base et
      // aucun verrouillage. Avec l'incrément atomique
      // (`incrementFailedAttempts`), Postgres sérialise les écritures
      // concurrentes sur la ligne : chaque tentative relit la valeur déjà
      // committée par la précédente.
      const phone = `+22178${Date.now().toString().slice(-5)}9${Math.floor(Math.random() * 10)}`;
      const patron = await registerTenant(phone);

      const attempts = Array.from({ length: 10 }, () =>
        login(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, pin: "0000" },
        ).catch((error: unknown) => error),
      );
      const results = await Promise.all(attempts);

      expect(results.every((result) => result instanceof Error)).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: patron.id } });
      // Les 10 tentatives concurrentes se sont bien toutes traduites par un
      // incrément réel (pas de lost update) — le compteur reflète le nombre
      // réel de tentatives, pas une valeur figée à 1.
      expect(user?.failedAttempts).toBe(10);
      expect(user?.lockedUntil).not.toBeNull();

      // Une tentative séquentielle suivante, même avec le bon PIN, doit être
      // rejetée : le compte est bien verrouillé, pas seulement le compteur
      // correctement incrémenté.
      await expect(
        login(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, pin: "1234" },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("réinitialise failedAttempts après une connexion réussie", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}3`;
      const patron = await registerTenant(phone);

      await expect(
        login(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, pin: "0000" },
        ),
      ).rejects.toThrow(ValidationError);

      await login(
        { repository, hasher, auditLogger },
        { channel: "PHONE", identifier: phone, pin: "1234" },
      );

      const user = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(user?.failedAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    });
  });

  describe("requestPinReset / confirmPinReset", () => {
    it("répond silencieusement pour un identifiant qui n'existe pas (régression énumération de compte)", async () => {
      const unknownPhone = `+22178${Date.now().toString().slice(-6)}6`;
      const sendOtpMock = vi.fn().mockResolvedValue(undefined);

      await expect(
        requestPinReset(
          { repository, otpSender: { sendOtp: sendOtpMock }, hasher },
          { channel: "PHONE", identifier: unknownPhone },
        ),
      ).resolves.toBeUndefined();

      expect(sendOtpMock).not.toHaveBeenCalled();
      const otpRecord = await prisma.otpCode.findFirst({
        where: { identifier: unknownPhone, purpose: "PIN_RESET" },
      });
      expect(otpRecord).toBeNull();
    });

    it("réinitialise le PIN via le canal email", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}8`;
      const email = `awa${Date.now()}@gestia.test`;
      const patron = await registerTenant(phone, email);

      let sentTo: string | undefined;
      await requestPinReset(
        { repository, otpSender: { sendOtp: async (to) => void (sentTo = to) }, hasher },
        { channel: "EMAIL", identifier: email },
      );
      expect(sentTo).toBe(email);

      const otpRecord = await prisma.otpCode.findFirst({
        where: { identifier: email, channel: "EMAIL", purpose: "PIN_RESET" },
        orderBy: { createdAt: "desc" },
      });
      expect(otpRecord).not.toBeNull();

      // Le code réel envoyé par requestPinReset est haché en base et donc
      // inaccessible ici : on le remplace par un code connu pour exercer
      // confirmPinReset de bout en bout.
      await prisma.otpCode.update({
        where: { id: otpRecord!.id },
        data: { codeHash: await hasher.hash("654321") },
      });

      await confirmPinReset(
        { repository, hasher, auditLogger },
        { channel: "EMAIL", identifier: email, otp: "654321", newPin: "4321" },
      );

      const user = await login(
        { repository, hasher, auditLogger },
        { channel: "EMAIL", identifier: email, pin: "4321" },
      );
      expect(user.id).toBe(patron.id);
    });

    it("pose firstLoginAt une seule fois, jamais réécrit lors d'un reset ultérieur", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}7`;
      const email = `awa${Date.now()}@gestia.test`;
      const patron = await registerTenant(phone, email);

      async function resetPinWith(newPin: string) {
        const otpCode = `${Date.now()}`.slice(-6);
        await prisma.otpCode.create({
          data: {
            identifier: email,
            channel: "EMAIL",
            purpose: "PIN_RESET",
            codeHash: await hasher.hash(otpCode),
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
        await confirmPinReset(
          { repository, hasher, auditLogger },
          { channel: "EMAIL", identifier: email, otp: otpCode, newPin },
        );
      }

      const beforeAnyReset = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(beforeAnyReset?.firstLoginAt).toBeNull();

      await resetPinWith("4321");
      const afterFirstReset = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(afterFirstReset?.firstLoginAt).not.toBeNull();

      await resetPinWith("5678");
      const afterSecondReset = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(afterSecondReset?.firstLoginAt?.getTime()).toBe(
        afterFirstReset?.firstLoginAt?.getTime(),
      );
    });

    it("invalide l'OTP bien avant la 20e tentative de code erroné (régression brute-force)", async () => {
      // Reproduit le scénario de l'audit sécurité : 20 tentatives de code
      // erroné sur le même OTP actif. Avant le fix, aucune limite n'existait
      // — l'OTP restait actif indéfiniment, ouvrant la voie à un brute-force
      // exhaustif du code à 6 chiffres.
      const phone = `+22178${Date.now().toString().slice(-6)}4`;
      const patron = await registerTenant(phone);
      const realCode = "999999";
      const otpRecord = await prisma.otpCode.create({
        data: {
          identifier: phone,
          channel: "PHONE",
          purpose: "PIN_RESET",
          codeHash: await hasher.hash(realCode),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      for (let i = 0; i < 20; i++) {
        await expect(
          confirmPinReset(
            { repository, hasher, auditLogger },
            { channel: "PHONE", identifier: phone, otp: "000000", newPin: "9999" },
          ),
        ).rejects.toThrow(ValidationError);
      }

      const afterAttempts = await prisma.otpCode.findUnique({ where: { id: otpRecord.id } });
      expect(afterAttempts?.consumedAt).not.toBeNull();
      expect(afterAttempts?.attempts).toBeLessThan(20);

      // Même le VRAI code, soumis après invalidation, doit échouer — pas de
      // déblocage automatique, l'utilisateur doit redemander un nouvel OTP.
      await expect(
        confirmPinReset(
          { repository, hasher, auditLogger },
          { channel: "PHONE", identifier: phone, otp: realCode, newPin: "9999" },
        ),
      ).rejects.toThrow(ValidationError);

      const finalUser = await prisma.user.findUnique({ where: { id: patron.id } });
      expect(finalUser?.pinHash).toBe(patron.pinHash);
    });

    it("n'accepte qu'une seule des deux confirmations concurrentes avec le même OTP (régression TOCTOU)", async () => {
      const phone = `+22178${Date.now().toString().slice(-6)}5`;
      await registerTenant(phone);
      const code = "123123";
      await prisma.otpCode.create({
        data: {
          identifier: phone,
          channel: "PHONE",
          purpose: "PIN_RESET",
          codeHash: await hasher.hash(code),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const attempts = await Promise.all(
        [1, 2].map((n) =>
          confirmPinReset(
            { repository, hasher, auditLogger },
            { channel: "PHONE", identifier: phone, otp: code, newPin: `000${n}` },
          ).then(
            () => "success" as const,
            () => "failure" as const,
          ),
        ),
      );

      expect(attempts.filter((result) => result === "success")).toHaveLength(1);
      expect(attempts.filter((result) => result === "failure")).toHaveLength(1);
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

    it("crée le vendeur et l'OTP même si l'envoi du SMS échoue (panne fournisseur non bloquante)", async () => {
      const phone = `+22179${Date.now().toString().slice(-6)}3`;
      const patron = await registerTenant(phone);
      const vendeurPhone = `+22179${Date.now().toString().slice(-6)}4`;
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const vendeur = await inviteVendeur(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        {
          repository,
          otpSender: {
            sendOtp: async () => {
              throw new Error("Panne fournisseur SMS");
            },
          },
          hasher,
          auditLogger,
        },
        { name: "Vendeur Test", phone: vendeurPhone },
      );

      expect(vendeur.role).toBe("VENDEUR");
      const otpRecord = await prisma.otpCode.findFirst({
        where: { identifier: vendeurPhone, purpose: "PIN_RESET" },
      });
      expect(otpRecord).not.toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Échec de l'envoi du SMS d'invitation vendeur :",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
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

  describe("reactivateVendeur", () => {
    it("réactive un vendeur désactivé du même tenant quand l'appelant est PATRON", async () => {
      const phone = `+22170${Date.now().toString().slice(-6)}5`;
      const patron = await registerTenant(phone);
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: `+22170${Date.now().toString().slice(-6)}6`,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });
      await repository.setActive(vendeur.id, false);

      await reactivateVendeur(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository, auditLogger },
        { vendeurId: vendeur.id },
      );

      const updated = await prisma.user.findUnique({ where: { id: vendeur.id } });
      expect(updated?.active).toBe(true);
    });

    it("refuse si l'appelant n'est pas PATRON", async () => {
      const phone = `+22170${Date.now().toString().slice(-6)}7`;
      const patron = await registerTenant(phone);
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: `+22170${Date.now().toString().slice(-6)}8`,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });
      await repository.setActive(vendeur.id, false);

      await expect(
        reactivateVendeur(
          { tenantId: patron.tenantId, userId: vendeur.id, role: "VENDEUR" },
          { repository, auditLogger },
          { vendeurId: vendeur.id },
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("updateVendeur", () => {
    it("modifie le nom d'un vendeur du même tenant quand l'appelant est PATRON", async () => {
      const phone = `+22170${Date.now().toString().slice(-6)}9`;
      const patron = await registerTenant(phone);
      const originalPhone = `+22171${Date.now().toString().slice(-6)}1`;
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: originalPhone,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });

      await updateVendeur(
        { tenantId: patron.tenantId, userId: patron.id, role: "PATRON" },
        { repository, auditLogger },
        { vendeurId: vendeur.id, name: "Vendeur Renommé" },
      );

      const updated = await prisma.user.findUnique({ where: { id: vendeur.id } });
      expect(updated?.name).toBe("Vendeur Renommé");
      // Le téléphone (identifiant de connexion) ne doit jamais changer via ce
      // chemin — updateVendeur n'accepte même pas ce champ en entrée.
      expect(updated?.phone).toBe(originalPhone);
    });

    it("refuse si l'appelant n'est pas PATRON", async () => {
      const phone = `+22171${Date.now().toString().slice(-6)}2`;
      const patron = await registerTenant(phone);
      const vendeur = await repository.createVendeur({
        tenantId: patron.tenantId,
        name: "Vendeur",
        phone: `+22171${Date.now().toString().slice(-6)}3`,
        placeholderPinHash: await hasher.hash(crypto.randomUUID()),
      });

      await expect(
        updateVendeur(
          { tenantId: patron.tenantId, userId: vendeur.id, role: "VENDEUR" },
          { repository, auditLogger },
          { vendeurId: vendeur.id, name: "Autre nom" },
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
