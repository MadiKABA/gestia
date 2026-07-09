import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createTransaction } from "@/application/transaction/create-transaction.use-case";
import { deleteTransaction } from "@/application/transaction/delete-transaction.use-case";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) — même
 * convention que party.use-cases.test.ts.
 */
describe("use cases transaction", () => {
  const tenantId = "test-tenant-transaction-usecases";
  const repository = new PrismaTransactionRepository(tenantId);
  const partyRepository = new PrismaPartyRepository(tenantId);
  const auditLogger = new PrismaAuditLogger();

  const patronContext: TenantContext = { tenantId, userId: "", role: "PATRON" };
  const vendeurContext: TenantContext = { tenantId, userId: "", role: "VENDEUR" };
  let partyId: string;

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test transaction uc" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999923",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    patronContext.userId = patron.id;
    vendeurContext.userId = patron.id;

    const party = await partyRepository.create(createId(), {
      name: "Fatou Diop",
      phone: "+221771234650",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("createTransaction écrit une entrée AuditLog, autorisé pour un VENDEUR", async () => {
    const transaction = await createTransaction(
      vendeurContext,
      { repository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz", amount: 15000 },
    );

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "Transaction",
        entityId: transaction.id,
        action: "transaction.created",
      },
    });
    expect(log).not.toBeNull();
  });

  it("createTransaction rejette un partyId inconnu", async () => {
    await expect(
      createTransaction(patronContext, { repository, partyRepository, auditLogger }, createId(), {
        partyId: "party-introuvable",
        type: "CREANCE",
        description: "Test",
        amount: 1000,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("deleteTransaction refuse un VENDEUR", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "DETTE", description: "À ne pas supprimer par un vendeur", amount: 2000 },
    );

    await expect(
      deleteTransaction(vendeurContext, { repository, auditLogger }, transaction.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deleteTransaction (PATRON) fait un soft delete et écrit une entrée AuditLog", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "À supprimer", amount: 3000 },
    );

    await deleteTransaction(patronContext, { repository, auditLogger }, transaction.id);

    const found = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(found?.deletedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "Transaction",
        entityId: transaction.id,
        action: "transaction.deleted",
      },
    });
    expect(log).not.toBeNull();

    await expect(repository.findById(transaction.id)).resolves.toBeNull();
  });
});
