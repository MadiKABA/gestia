import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createParty } from "@/application/party/create-party.use-case";
import { deleteParty } from "@/application/party/delete-party.use-case";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { createTransaction } from "@/application/transaction/create-transaction.use-case";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/shared/errors";
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
  /** Stub par défaut : le blocage de suppression sur transactions ouvertes
   * est couvert par ses propres cas dans ce fichier (voir plus bas), pas
   * besoin de le réévaluer pour ces tests-ci. */
  const hasOpenTransactions = async () => false;

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
      deleteParty(vendeurContext, { repository, auditLogger, hasOpenTransactions }, party.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deleteParty (PATRON) fait un soft delete et écrit une entrée AuditLog", async () => {
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Ibrahima Fall",
      phone: "+221771234569",
      type: "CLIENT",
    });

    await deleteParty(patronContext, { repository, auditLogger, hasOpenTransactions }, party.id);

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
    await deleteParty(patronContext, { repository, auditLogger, hasOpenTransactions }, party.id);

    await expect(
      deleteParty(patronContext, { repository, auditLogger, hasOpenTransactions }, party.id),
    ).rejects.toThrow(NotFoundError);
  });

  it("deleteParty bloque un tiers ayant une transaction non soldée (hasOpenTransactions réel)", async () => {
    const transactionRepository = new PrismaTransactionRepository(tenantId);
    const party = await createParty(patronContext, { repository, auditLogger }, createId(), {
      name: "Bineta Fall",
      phone: "+221771234571",
      type: "CLIENT",
    });
    await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository: repository, auditLogger },
      createId(),
      { partyId: party.id, type: "CREANCE", description: "Créance non soldée", amount: 5000 },
    );

    await expect(
      deleteParty(
        patronContext,
        {
          repository,
          auditLogger,
          hasOpenTransactions: (partyId) =>
            transactionRepository.hasOpenTransactionsForParty(partyId),
        },
        party.id,
      ),
    ).rejects.toThrow(ValidationError);

    // Jamais supprimé : le tiers reste actif après le blocage.
    await expect(repository.findById(party.id)).resolves.not.toBeNull();
  });
});
