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
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Deux paiements en ligne consécutifs sur la même transaction, dans la même
 * session : le premier consomme une partie du solde, le second (tenté juste
 * après, sans jamais repasser hors ligne) doit être rejeté immédiatement si
 * son montant dépasse le solde restant RÉEL — jamais accepté sur la base
 * d'un cache local pas encore rafraîchi. Distinct de
 * payment-offline.repository.test.ts, qui couvre un cache déjà périmé au
 * départ, pas une race consécutive dans la même session.
 */
describe("Payment — double paiement en ligne consécutif dépassant le nouveau solde", () => {
  const tenantId = "test-tenant-payment-consecutive-race";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let partyId: string;

  const syncTransport = async (mutation: QueuedMutation) => {
    try {
      return { ok: true as const, data: await syncMutation(context, { auditLogger }, mutation) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { ok: false as const, reason: "validation_error" as const, message: error.message };
      }
      throw error;
    }
  };

  beforeAll(async () => {
    registerMutationHandler("payment", paymentMutationHandler);
    registerMutationSchema("payment", paymentSyncPayloadSchema);

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant race paiement consécutif" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999960",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client race paiement",
      phone: "+221771234690",
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

  it("solde 10000 : paiement 1 = 7000 (OK) puis paiement 2 = 4000 tenté juste après (dépasse le solde restant de 3000) rejeté immédiatement", async () => {
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

    const repository = new PaymentOfflineRepository({
      tenantId,
      userId: context.userId,
      syncTransport,
    });

    await repository.create({ transactionId: transaction.id, amount: 7000, method: "WAVE" });

    const txAfterPayment1 = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(txAfterPayment1?.paidAmount.toNumber()).toBe(7000);
    expect(txAfterPayment1?.status).toBe("PARTIELLE");

    // Solde restant réel maintenant 3000 : 4000 doit être rejeté
    // immédiatement, jamais mis en queue, jamais écrit en base.
    await expect(
      repository.create({ transactionId: transaction.id, amount: 4000, method: "CASH" }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await listPendingMutations(tenantId)).toHaveLength(0);

    const paymentsInDb = await prisma.payment.findMany({
      where: { tenantId, transactionId: transaction.id },
    });
    expect(paymentsInDb).toHaveLength(1);
    expect(paymentsInDb[0].amount.toNumber()).toBe(7000);

    const txFinal = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(txFinal?.paidAmount.toNumber()).toBe(7000);
    expect(txFinal?.status).toBe("PARTIELLE");
  });
});
