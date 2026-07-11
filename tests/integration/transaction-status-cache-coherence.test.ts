import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { paymentMutationHandler } from "@/infrastructure/payment/payment-mutation-handler";
import { paymentSyncPayloadSchema } from "@/infrastructure/payment/payment-mutation.schema";
import { transactionPullHandler } from "@/infrastructure/transaction/transaction-pull-handler";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { pullEntity, type PullTransport } from "@/infrastructure/offline/pull-engine";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { TransactionOfflineRepository } from "@/infrastructure/transaction/transaction-offline.repository";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Vérifie la cohérence statut/paidAmount sur le vrai chemin de lecture
 * utilisé par TransactionDetail (repository.getById, donc le cache local),
 * pas seulement prisma.transaction.findUnique — juste après un paiement
 * hors ligne, puis après le cycle push+pull complet de sync.
 */
describe("Transaction — cohérence du statut affiché (cache) après un paiement hors ligne synchronisé", () => {
  const tenantId = "test-tenant-tx-status-cache-coherence";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let partyId: string;

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });
  const pullTransport: PullTransport = async (input) => ({
    ok: true,
    data: await pullChanges(context, input.entity, new Date(input.since), input.pageCursor),
  });

  beforeAll(async () => {
    registerMutationHandler("payment", paymentMutationHandler);
    registerMutationSchema("payment", paymentSyncPayloadSchema);
    registerPullHandler("transaction", transactionPullHandler);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant cohérence statut transaction" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999980",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client cohérence statut",
      phone: "+221771234695",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.transaction.deleteMany({ where: { tenantId } });
    await prisma.party.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("paiement hors ligne (6000/10000) : cache immédiatement PARTIELLE, reste cohérent avec la base après push+pull", async () => {
    const transactionRepository = new PrismaTransactionRepository(tenantId);
    const transaction = await transactionRepository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz", amount: 10000 },
      context.userId,
    );
    await setCachedEntity(
      tenantId,
      "transaction",
      transaction.id,
      transaction,
      transaction.updatedAt.toISOString(),
    );

    const paymentRepo = new PaymentOfflineRepository({ tenantId, userId: context.userId });
    await paymentRepo.create({ transactionId: transaction.id, amount: 6000, method: "CASH" });

    // Lecture via le vrai chemin de TransactionDetail : repository.getById (cache).
    const txReadRepo = new TransactionOfflineRepository({ tenantId, userId: context.userId });
    const cachedImmediatelyAfterOfflinePayment = await txReadRepo.getById(transaction.id);
    expect(cachedImmediatelyAfterOfflinePayment?.status).toBe("PARTIELLE");
    expect(cachedImmediatelyAfterOfflinePayment?.paidAmount).toBe(6000);

    // Rien en base à ce stade : le paiement est toujours en queue.
    const txInDbBeforeSync = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(txInDbBeforeSync?.status).toBe("EN_COURS");
    expect(txInDbBeforeSync?.paidAmount.toNumber()).toBe(0);

    // Cycle complet push + pull (comme network-status-store.runSync).
    const pushResult = await syncQueue({ tenantId, syncTransport });
    expect(pushResult).toEqual({ succeeded: 1, remaining: 0, failed: false });
    await pullEntity({ tenantId, entity: "transaction", pullTransport });

    const cachedAfterSync = await txReadRepo.getById(transaction.id);
    const txInDbAfterSync = await prisma.transaction.findUnique({ where: { id: transaction.id } });

    expect(txInDbAfterSync?.status).toBe("PARTIELLE");
    expect(txInDbAfterSync?.paidAmount.toNumber()).toBe(6000);
    expect(cachedAfterSync?.status).toBe(txInDbAfterSync?.status);
    expect(cachedAfterSync?.paidAmount).toBe(txInDbAfterSync?.paidAmount.toNumber());
  });
});
