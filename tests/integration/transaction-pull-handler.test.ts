import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { transactionPullHandler } from "@/infrastructure/transaction/transaction-pull-handler";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Gestionnaire de pull de production pour Transaction — même convention que
 * party-pull-handler.test.ts. Se concentre sur les particularités propres à
 * Transaction : `reference` réellement présente (générée à la création,
 * jamais `null` pour une ligne déjà en base) et conversion Decimal→number.
 */
describe("transactionPullHandler", () => {
  const tenantId = "test-tenant-transaction-pull-handler";
  const context: TenantContext = { tenantId, userId: "user-1", role: "PATRON" };
  let repository: PrismaTransactionRepository;
  let partyId: string;

  beforeAll(async () => {
    registerPullHandler("transaction", transactionPullHandler);
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant pull handler transaction" } });
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999924",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = user.id;

    repository = new PrismaTransactionRepository(tenantId);
    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Tiers pull transaction",
      phone: "+221771234660",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("renvoie la transaction créée avec sa référence réelle et un montant en number", async () => {
    const since = new Date(Date.now() - 1000);
    const created = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Transaction pull", amount: 12500 },
      context.userId,
    );

    const result = await pullChanges(context, "transaction", since);

    const record = result.records.find((r) => r.id === created.id);
    expect(record).toBeDefined();
    const data = record?.data as { reference: string | null; amount: number };
    expect(data.reference).toBe(created.reference);
    expect(data.reference).toMatch(/^CR-\d{4}-\d{5}$/);
    expect(data.amount).toBe(12500);
    expect(typeof data.amount).toBe("number");
  });

  it("signale une transaction soft-deleted via `deletedAt`", async () => {
    const since = new Date(Date.now() - 1000);
    const created = await repository.create(
      createId(),
      { partyId, type: "DETTE", description: "À retirer du cache", amount: 4000 },
      context.userId,
    );
    await repository.delete(created.id);

    const result = await pullChanges(context, "transaction", since);

    const record = result.records.find((r) => r.id === created.id);
    expect(record?.deletedAt).not.toBeNull();
  });

  it("ne renvoie rien pour un tenant sans le moindre changement", async () => {
    const otherTenantId = "test-tenant-transaction-pull-handler-other";
    await prisma.tenant.create({ data: { id: otherTenantId, name: "Autre tenant" } });
    const otherContext: TenantContext = {
      tenantId: otherTenantId,
      userId: "user-2",
      role: "PATRON",
    };

    const result = await pullChanges(otherContext, "transaction", new Date(0));

    expect(result.records).toEqual([]);

    await prisma.tenant.delete({ where: { id: otherTenantId } });
  });
});
