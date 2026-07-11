import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { cashMovementMutationHandler } from "@/infrastructure/cash-movement/cash-movement-mutation-handler";
import { cashMovementSyncPayloadSchema } from "@/infrastructure/cash-movement/cash-movement-mutation.schema";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { CashMovementOfflineRepository } from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { getCashBalance } from "@/application/cash-movement/get-cash-balance.use-case";
import { PrismaCashMovementRepository } from "@/infrastructure/cash-movement/cash-movement.repository";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Séquence de mouvements de caisse mêlant hors ligne et en ligne : une fois
 * synchronisés, le solde retourné par getCashBalance (utilisé par la page
 * /caisse) doit correspondre exactement à la somme réelle des lignes en
 * base — jamais une approximation dérivée d'un cache local partiel.
 */
describe("CashMovement — solde après séquence mixte hors ligne / en ligne", () => {
  const tenantId = "test-tenant-cash-balance-reconciliation";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("cashMovement", cashMovementMutationHandler);
    registerMutationSchema("cashMovement", cashMovementSyncPayloadSchema);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant réconciliation solde caisse" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999970",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("2 mouvements hors ligne + 1 en ligne, puis sync : solde = somme réelle des lignes en base", async () => {
    const offlineRepo = new CashMovementOfflineRepository({ tenantId, userId: context.userId });
    await offlineRepo.create({ type: "ENTREE", amount: 20000, reason: "Vente hors ligne 1" });
    await offlineRepo.create({ type: "SORTIE", amount: 5000, reason: "Achat hors ligne" });

    const onlineRepo = new CashMovementOfflineRepository({
      tenantId,
      userId: context.userId,
      syncTransport,
    });
    await onlineRepo.create({ type: "ENTREE", amount: 8000, reason: "Vente en ligne" });

    const syncResult = await syncQueue({ tenantId, syncTransport });
    expect(syncResult).toEqual({ succeeded: 2, remaining: 0, failed: false });

    const balanceViaUseCase = await getCashBalance(context, {
      repository: new PrismaCashMovementRepository(tenantId),
    });

    const rows = await prisma.cashMovement.findMany({ where: { tenantId } });
    const realTotalEntree = rows
      .filter((r) => r.type === "ENTREE")
      .reduce((sum, r) => sum + r.amount.toNumber(), 0);
    const realTotalSortie = rows
      .filter((r) => r.type === "SORTIE")
      .reduce((sum, r) => sum + r.amount.toNumber(), 0);

    expect(balanceViaUseCase.totalEntree).toBe(realTotalEntree);
    expect(balanceViaUseCase.totalSortie).toBe(realTotalSortie);
    expect(balanceViaUseCase.totalEntree).toBe(28000);
    expect(balanceViaUseCase.totalSortie).toBe(5000);
  });
});
