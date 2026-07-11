import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { paymentPullHandler } from "@/infrastructure/payment/payment-pull-handler";
import { cashMovementPullHandler } from "@/infrastructure/cash-movement/cash-movement-pull-handler";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { pullEntity, type PullTransport } from "@/infrastructure/offline/pull-engine";
import { getCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * "Modifié/créé directement en base par un autre appareil -> pull -> cache
 * local IndexedDB reflète le changement", pour Payment et CashMovement —
 * offline-bidirectional-sync.test.ts ne couvre ce scénario que pour Party ;
 * les *-pull-handler.test.ts n'exercent que la couche serveur (pullChanges),
 * jamais l'écriture dans le cache client (pullEntity -> local-cache.store).
 */
describe("Pull cross-entité : le cache local reflète un changement fait directement en base", () => {
  const tenantId = "test-tenant-payment-cash-pull-cache";
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let transactionId: string;

  const pullTransport: PullTransport = async (input) => ({
    ok: true,
    data: await pullChanges(context, input.entity, new Date(input.since), input.pageCursor),
  });

  beforeAll(async () => {
    registerPullHandler("payment", paymentPullHandler);
    registerPullHandler("cashMovement", cashMovementPullHandler);

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant pull cross-entité" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999990",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Client pull cross-entité",
      phone: "+221771234699",
      type: "CLIENT",
    });

    const transaction = await new PrismaTransactionRepository(tenantId).create(
      createId(),
      { partyId: party.id, type: "CREANCE", description: "Sac de riz", amount: 10000 },
      context.userId,
    );
    transactionId = transaction.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.cashMovement.deleteMany({ where: { tenantId } });
    await prisma.transaction.deleteMany({ where: { tenantId } });
    await prisma.party.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("Payment créé directement en base (simulant un autre appareil) apparaît dans le cache local après pull", async () => {
    // Écriture directe Prisma, sans passer par PaymentOfflineRepository ni
    // syncQueue : simule fidèlement "un autre appareil a créé ce paiement".
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        transactionId,
        amount: 3000,
        method: "WAVE",
        direction: "IN",
        createdById: context.userId,
      },
    });

    expect(await getCachedEntity(tenantId, "payment", payment.id)).toBeUndefined();

    const result = await pullEntity({ tenantId, entity: "payment", pullTransport });

    const cachedAfter = await getCachedEntity<{ amount: number; method: string }>(
      tenantId,
      "payment",
      payment.id,
    );
    expect(result.applied).toBeGreaterThanOrEqual(1);
    expect(cachedAfter?.data.amount).toBe(3000);
    expect(cachedAfter?.data.method).toBe("WAVE");
  });

  it("CashMovement créé directement en base (simulant un autre appareil) apparaît dans le cache local après pull", async () => {
    const movement = await prisma.cashMovement.create({
      data: {
        tenantId,
        type: "SORTIE",
        amount: 1500,
        reason: "Créé par un autre poste",
        createdById: context.userId,
      },
    });

    expect(await getCachedEntity(tenantId, "cashMovement", movement.id)).toBeUndefined();

    const result = await pullEntity({ tenantId, entity: "cashMovement", pullTransport });

    const cachedAfter = await getCachedEntity<{ amount: number; reason: string }>(
      tenantId,
      "cashMovement",
      movement.id,
    );
    expect(result.applied).toBeGreaterThanOrEqual(1);
    expect(cachedAfter?.data.amount).toBe(1500);
    expect(cachedAfter?.data.reason).toBe("Créé par un autre poste");
  });
});
