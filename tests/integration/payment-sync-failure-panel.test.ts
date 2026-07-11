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
import { registerPayment } from "@/application/payment/register-payment.use-case";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import {
  discardMutation,
  listFailedMutations,
  listPendingMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Reproduit le scénario "solde changé entre-temps par un autre appareil" :
 * paiement mis en attente hors ligne, un autre appareil règle une partie du
 * solde entre-temps, l'erreur n'est détectée qu'à la sync différée. Vérifie
 * qu'elle sort proprement de la boucle de retry et apparaît dans la même
 * source de données que SyncFailuresPanel (listFailedMutations) au lieu de
 * boucler indéfiniment, puis que "Ignorer cette action" nettoie
 * correctement la queue et le cache local.
 */
describe("Payment — erreur de validation détectée à la sync différée -> interface de résolution", () => {
  const tenantId = "test-tenant-payment-sync-failure-panel";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let partyId: string;

  // Reproduit EXACTEMENT le catch de syncMutationAction
  // (presentation/offline/actions.ts) : c'est cette conversion
  // ValidationError -> {ok:false, reason:"validation_error"} qui permet à
  // sync-engine.ts de distinguer un échec définitif d'un échec transitoire.
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

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant panneau résolution paiement" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999995",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client panneau résolution",
      phone: "+221771234698",
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

  it("solde changé par un autre appareil pendant l'attente hors ligne : sort en échec définitif, visible et résoluble via le panneau", async () => {
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

    // Paiement hors ligne de 8000 : valide localement contre le cache (solde
    // 10000 connu à ce moment), donc enfilé sans erreur.
    const offlineRepo = new PaymentOfflineRepository({ tenantId, userId: context.userId });
    const offlinePayment = await offlineRepo.create({
      transactionId: transaction.id,
      amount: 8000,
      method: "CASH",
    });

    // "Un autre appareil", en ligne, règle 5000 directement pendant que le
    // premier reste hors ligne — le solde restant réel tombe à 5000.
    await registerPayment(
      context,
      {
        paymentRepository: new PrismaPaymentRepository(tenantId),
        transactionRepository,
        auditLogger,
      },
      createId(),
      { transactionId: transaction.id, amount: 5000, method: "WAVE" },
    );

    // Retour en ligne : la sync différée tente enfin le paiement de 8000,
    // qui dépasse maintenant le solde restant réel (5000).
    const syncResult = await syncQueue({ tenantId, syncTransport });
    expect(syncResult.failed).toBe(false); // l'échec définitif n'empêche pas le passage de continuer

    const pending = await listPendingMutations(tenantId);
    const failed = await listFailedMutations(tenantId);
    expect(pending).toHaveLength(0); // plus jamais retentée automatiquement
    expect(failed).toHaveLength(1);
    expect(failed[0].entity).toBe("payment");
    expect(failed[0].syncError).toMatch(/solde/i);

    // Le paiement fantôme de 8000 n'a jamais atteint la base.
    const paymentsInDb = await prisma.payment.findMany({
      where: { tenantId, transactionId: transaction.id },
    });
    expect(paymentsInDb).toHaveLength(1);
    expect(paymentsInDb[0].amount.toNumber()).toBe(5000);

    // "Ignorer cette action" (bouton du panneau) : nettoie la queue ET le
    // cache optimiste fantôme (voir discardMutation, action="create").
    expect(await getCachedEntity(tenantId, "payment", offlinePayment.id)).not.toBeUndefined();
    await discardMutation(failed[0].id);
    expect(await getCachedEntity(tenantId, "payment", offlinePayment.id)).toBeUndefined();
    expect(await listFailedMutations(tenantId)).toHaveLength(0);
  });
});
