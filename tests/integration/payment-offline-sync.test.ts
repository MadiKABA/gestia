import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { paymentMutationHandler } from "@/infrastructure/payment/payment-mutation-handler";
import { paymentSyncPayloadSchema } from "@/infrastructure/payment/payment-mutation.schema";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Test d'intégration bout-en-bout du module Payment offline-first — même
 * structure que transaction-offline-sync.test.ts. Pas de test de conflit
 * dernier-écrit-gagne ici : un paiement n'a pas d'action `update` (voir
 * payment-mutation-handler.ts), donc jamais de conflit possible pour cette
 * entity.
 */
describe("Payment offline-first : bout en bout", () => {
  const tenantId = "test-tenant-payment-offline";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let partyId: string;

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("payment", paymentMutationHandler);
    registerMutationSchema("payment", paymentSyncPayloadSchema);

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test offline payment" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999926",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client offline payment",
      phone: "+221771234680",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  /** Amorce le cache local "transaction" — préalable à tout paiement offline
   * (PaymentOfflineRepository.create lit la transaction depuis ce cache). */
  async function createTransactionAndSeedCache(amount: number) {
    const transactionRepository = new PrismaTransactionRepository(tenantId);
    const transaction = await transactionRepository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz", amount },
      context.userId,
    );
    await setCachedEntity(
      tenantId,
      "transaction",
      transaction.id,
      transaction,
      transaction.updatedAt.toISOString(),
    );
    return transaction;
  }

  it("payer hors ligne : visible immédiatement (transaction patchée en cache), puis synchronisé avec AuditLog", async () => {
    const transaction = await createTransactionAndSeedCache(10000);
    const repository = new PaymentOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      transactionId: transaction.id,
      amount: 4000,
      method: "WAVE",
    });

    expect(await prisma.payment.findUnique({ where: { id: created.id } })).toBeNull();

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.payment.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.amount.toNumber()).toBe(4000);

    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    });
    expect(updatedTransaction?.paidAmount.toNumber()).toBe(4000);
    expect(updatedTransaction?.status).toBe("PARTIELLE");

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Payment", entityId: created.id, action: "payment.created" },
    });
    expect(log).not.toBeNull();
  });

  it("retry d'un paiement déjà appliqué : rejoué sans erreur, sans double incrément de paidAmount", async () => {
    const transaction = await createTransactionAndSeedCache(5000);
    const repository = new PaymentOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      transactionId: transaction.id,
      amount: 2000,
      method: "CASH",
    });

    const mutation: QueuedMutation = {
      id: "mutation-payment-1",
      tenantId,
      entity: "payment",
      action: "create",
      payload: { transactionId: transaction.id, amount: 2000, method: "CASH" },
      clientGeneratedId: created.id,
      createdAt: new Date().toISOString(),
      createdById: context.userId,
    };

    const firstAttempt = await syncTransport(mutation);
    const secondAttempt = await syncTransport(mutation);

    expect(secondAttempt.data.updatedAt).toBe(firstAttempt.data.updatedAt);
    expect(await prisma.payment.count({ where: { tenantId, id: created.id } })).toBe(1);

    const inDb = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    // Un seul incrément malgré les deux tentatives de sync.
    expect(inDb?.paidAmount.toNumber()).toBe(2000);
  });

  it("reprise après fermeture de l'app : la queue persistée en IndexedDB est rejouée indépendamment de tout état en mémoire", async () => {
    const transaction = await createTransactionAndSeedCache(3000);
    const repository = new PaymentOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      transactionId: transaction.id,
      amount: 3000,
      method: "ORANGE_MONEY",
    });
    // Jamais synchronisé ici — simule l'app fermée avant la sync.

    const pendingAfterReload = await listPendingMutations(tenantId);
    expect(pendingAfterReload.some((m) => m.clientGeneratedId === created.id)).toBe(true);

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result.failed).toBe(false);

    expect(await prisma.payment.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  it("rejette un payload invalide (montant négatif) avec une ValidationError propre, sans jamais écrire en base", async () => {
    const transaction = await createTransactionAndSeedCache(1000);
    const rejectedId = "payment-payload-invalide-test";

    await expect(
      syncTransport({
        id: "mutation-payload-invalide-payment",
        tenantId,
        entity: "payment",
        action: "create",
        payload: { transactionId: transaction.id, amount: -100, method: "CASH" },
        clientGeneratedId: rejectedId,
        createdAt: new Date().toISOString(),
        createdById: context.userId,
      }),
    ).rejects.toThrow(ValidationError);

    expect(await prisma.payment.findUnique({ where: { id: rejectedId } })).toBeNull();
  });

  it("refuse de créer un paiement hors ligne sans transaction déjà en cache", async () => {
    const repository = new PaymentOfflineRepository({ tenantId, userId: context.userId });

    await expect(
      repository.create({
        transactionId: "transaction-jamais-vue-en-local",
        amount: 100,
        method: "CASH",
      }),
    ).rejects.toThrow();
  });
});
