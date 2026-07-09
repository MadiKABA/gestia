import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { updateTransaction } from "@/application/transaction/update-transaction.use-case";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { transactionMutationHandler } from "@/infrastructure/transaction/transaction-mutation-handler";
import { transactionSyncPayloadSchema } from "@/infrastructure/transaction/transaction-mutation.schema";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { TransactionOfflineRepository } from "@/infrastructure/transaction/transaction-offline.repository";
import { ValidationError } from "@/domain/shared/errors";
import { createId } from "@paralleldrive/cuid2";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Test d'intégration bout-en-bout du retrofit offline-first de Transaction —
 * même structure que party-offline-sync.test.ts. Couvre en plus la
 * particularité propre à Transaction : `reference` absente en local
 * (`null`) jusqu'à ce que le pull qui suit toujours le push la rapatrie, et
 * le check-then-create qui évite de brûler un numéro de Sequence à chaque
 * retry.
 */
describe("Transaction offline-first : bout en bout", () => {
  const tenantId = "test-tenant-transaction-offline";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let partyId: string;

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("transaction", transactionMutationHandler);
    registerMutationSchema("transaction", transactionSyncPayloadSchema);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant de test offline transaction" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999925",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client offline transaction",
      phone: "+221771234670",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("créer hors ligne : reference absente localement, puis synchronisée avec AuditLog et vraie référence", async () => {
    const repository = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      partyId,
      type: "CREANCE",
      description: "Sac de riz",
      amount: 15000,
    });

    // Visible immédiatement en local, mais sans référence (jamais générée
    // hors ligne, voir transaction-offline.repository.ts).
    expect(created.reference).toBeNull();
    expect(await prisma.transaction.findUnique({ where: { id: created.id } })).toBeNull();

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.transaction.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.reference).toMatch(/^CR-\d{4}-\d{5}$/);
    expect(inDb?.id).toBe(created.id);

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "Transaction",
        entityId: created.id,
        action: "transaction.created",
      },
    });
    expect(log).not.toBeNull();
  });

  it("conflit dernier-écrit-gagne : écrase la valeur serveur et trace une seule entrée AuditLog", async () => {
    const repository = new TransactionOfflineRepository({ tenantId, userId: context.userId });
    const repositoryPrisma = new PrismaTransactionRepository(tenantId);

    const created = await repository.create({
      partyId,
      type: "DETTE",
      description: "Montant initial",
      amount: 1000,
    });
    await syncQueue({ tenantId, syncTransport });

    // "Session 2" modifie directement côté serveur pendant que "session 1"
    // reste hors ligne avec son propre changement en attente.
    await updateTransaction(context, { repository: repositoryPrisma, auditLogger }, created.id, {
      type: "DETTE",
      description: "Modifié par session 2",
      amount: 1000,
    });

    await repository.update(created.id, {
      partyId,
      type: "DETTE",
      description: "Modifié par session 1, hors ligne",
      amount: 1000,
    });

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.transaction.findUnique({ where: { id: created.id } });
    expect(inDb?.description).toBe("Modifié par session 1, hors ligne");

    const conflictLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        entity: "transaction",
        entityId: created.id,
        action: "transaction.sync_conflict",
      },
    });
    expect(conflictLogs).toHaveLength(1);
  });

  it("retry d'une création déjà appliquée : rejoué sans erreur, aucun doublon, aucun numéro de référence brûlé", async () => {
    const repository = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      partyId,
      type: "CREANCE",
      description: "Retry idempotent",
      amount: 2500,
    });

    const mutation: QueuedMutation = {
      id: "mutation-transaction-1",
      tenantId,
      entity: "transaction",
      action: "create",
      payload: { partyId, type: "CREANCE", description: "Retry idempotent", amount: 2500 },
      clientGeneratedId: created.id,
      createdAt: new Date().toISOString(),
      createdById: context.userId,
    };

    const firstAttempt = await syncTransport(mutation);
    const secondAttempt = await syncTransport(mutation);

    expect(secondAttempt.data.updatedAt).toBe(firstAttempt.data.updatedAt);
    expect(await prisma.transaction.count({ where: { tenantId, id: created.id } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          tenantId,
          entity: "Transaction",
          entityId: created.id,
          action: "transaction.created",
        },
      }),
    ).toBe(1);

    // Check-then-create (transaction-mutation-handler.ts) : le second appel
    // a trouvé la ligne déjà créée par le premier et n'est jamais entré
    // dans PrismaTransactionRepository.create, donc n'a pas incrémenté le
    // compteur Sequence une deuxième fois pour la même mutation.
    const inDb = await prisma.transaction.findUnique({ where: { id: created.id } });
    const year = new Date().getFullYear();
    const sequence = await prisma.sequence.findUnique({
      where: { tenantId_year: { tenantId, year } },
    });
    const referenceCounter = Number(inDb!.reference.split("-")[2]);
    expect(sequence?.creditCounter).toBe(referenceCounter);
  });

  it("reprise après fermeture de l'app : la queue persistée en IndexedDB est rejouée indépendamment de tout état en mémoire", async () => {
    const repository = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      partyId,
      type: "CREANCE",
      description: "Reprise après fermeture",
      amount: 6000,
    });
    // Jamais synchronisé ici — simule l'app fermée avant la sync.

    const pendingAfterReload = await listPendingMutations(tenantId);
    expect(pendingAfterReload.some((m) => m.clientGeneratedId === created.id)).toBe(true);

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result.failed).toBe(false);

    const inDb = await prisma.transaction.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
  });

  it("rejette un payload invalide (montant négatif) avec une ValidationError propre, sans jamais écrire en base", async () => {
    const rejectedId = "transaction-payload-invalide-test";

    await expect(
      syncTransport({
        id: "mutation-payload-invalide-transaction",
        tenantId,
        entity: "transaction",
        action: "create",
        payload: { partyId, type: "CREANCE", description: "Payload invalide", amount: -100 },
        clientGeneratedId: rejectedId,
        createdAt: new Date().toISOString(),
        createdById: context.userId,
      }),
    ).rejects.toThrow(ValidationError);

    expect(await prisma.transaction.findUnique({ where: { id: rejectedId } })).toBeNull();
  });
});
