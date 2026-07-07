import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createParty } from "@/application/party/create-party.use-case";
import { deleteParty } from "@/application/party/delete-party.use-case";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases critiques du module tiers (AuditLog, permissions, soft delete).
 */
describe("use cases party", () => {
  const tenantId = "test-tenant-party-usecases";
  const repository = new PrismaPartyRepository(tenantId);
  const auditLogger = new PrismaAuditLogger();

  const patronContext: TenantContext = { tenantId, userId: "", role: "PATRON" };
  const vendeurContext: TenantContext = { tenantId, userId: "", role: "VENDEUR" };

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999901",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    patronContext.userId = patron.id;
    vendeurContext.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("createParty écrit une entrée AuditLog", async () => {
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Fatou Diop",
      phone: "+221771234567",
      type: "CLIENT",
    });

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Party", entityId: party.id, action: "party.created" },
    });
    expect(log).not.toBeNull();
  });

  it("deleteParty refuse un VENDEUR", async () => {
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Moussa Sarr",
      phone: "+221771234568",
      type: "SUPPLIER",
    });

    await expect(
      deleteParty(vendeurContext, { repository, auditLogger }, party.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deleteParty (PATRON) fait un soft delete et écrit une entrée AuditLog", async () => {
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Ibrahima Fall",
      phone: "+221771234569",
      type: "CLIENT",
    });

    await deleteParty(patronContext, { repository, auditLogger }, party.id);

    const found = await prisma.party.findUnique({ where: { id: party.id } });
    expect(found?.deletedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Party", entityId: party.id, action: "party.deleted" },
    });
    expect(log).not.toBeNull();

    await expect(repository.findById(party.id)).resolves.toBeNull();
  });

  it("deleteParty rejette un tiers déjà supprimé", async () => {
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Khady Sow",
      phone: "+221771234570",
      type: "CLIENT",
    });
    await deleteParty(patronContext, { repository, auditLogger }, party.id);

    await expect(deleteParty(patronContext, { repository, auditLogger }, party.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
