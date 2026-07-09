import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { partyPullHandler } from "@/infrastructure/party/party-pull-handler";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Gestionnaire de pull de production pour Party (retrofit — voir CLAUDE.md).
 * Les scénarios de cycle bidirectionnel complet et d'isolation tenant sont
 * déjà couverts par tests/integration/offline-bidirectional-sync.test.ts et
 * offline-tenant-isolation.test.ts (qui utilisent désormais ce même
 * gestionnaire) ; ce fichier se concentre sur les particularités propres à
 * Party : solde réel agrégé (PrismaTransactionRepository.aggregateBalancesByParty,
 * voir aussi transaction-pull-handler.test.ts) et inclusion des entités
 * soft-deleted dans l'enveloppe du pull générique.
 */
describe("partyPullHandler", () => {
  const tenantId = "test-tenant-party-pull-handler";
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let repository: PrismaPartyRepository;

  beforeAll(async () => {
    registerPullHandler("party", partyPullHandler);
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant pull handler" } });
    // Utilisateur réel requis par la contrainte FK Transaction.createdById
    // (voir le nouveau test de solde ci-dessous) — "user-1" littéral
    // suffisait tant que Party n'avait aucune relation vers User.
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999926",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = user.id;
    repository = new PrismaPartyRepository(tenantId);
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("renvoie le tiers créé avec un solde à 0 tant qu'il n'a aucune transaction", async () => {
    const since = new Date(Date.now() - 1000);
    const created = await repository.create(createId(), {
      name: "Tiers solde",
      phone: "+221771234611",
      type: "CLIENT",
    });

    const result = await pullChanges(context, "party", since);

    const record = result.records.find((r) => r.id === created.id);
    expect(record).toBeDefined();
    expect((record?.data as { balance: number }).balance).toBe(0);
  });

  it("renvoie le solde net réel une fois des transactions rattachées au tiers", async () => {
    const since = new Date(Date.now() - 1000);
    const created = await repository.create(createId(), {
      name: "Tiers avec transactions",
      phone: "+221771234613",
      type: "CLIENT",
    });
    const transactionRepository = new PrismaTransactionRepository(tenantId);
    await transactionRepository.create(
      createId(),
      { partyId: created.id, type: "CREANCE", description: "Vente", amount: 20000 },
      context.userId,
    );
    await transactionRepository.create(
      createId(),
      { partyId: created.id, type: "DETTE", description: "Achat", amount: 7000 },
      context.userId,
    );

    const result = await pullChanges(context, "party", since);

    const record = result.records.find((r) => r.id === created.id);
    expect((record?.data as { balance: number }).balance).toBe(13000);
  });

  it("signale un tiers soft-deleted via `deletedAt` dans l'enveloppe du pull, pour que le client le retire de son cache", async () => {
    const since = new Date(Date.now() - 1000);
    const created = await repository.create(createId(), {
      name: "Tiers à retirer du cache",
      phone: "+221771234612",
      type: "CLIENT",
    });
    await repository.delete(created.id);

    const result = await pullChanges(context, "party", since);

    const record = result.records.find((r) => r.id === created.id);
    expect(record?.deletedAt).not.toBeNull();
  });

  it("ne renvoie rien pour un tenant sans le moindre changement", async () => {
    const otherTenantId = "test-tenant-party-pull-handler-other";
    await prisma.tenant.create({ data: { id: otherTenantId, name: "Autre tenant" } });
    const otherContext: TenantContext = {
      tenantId: otherTenantId,
      userId: "user-2",
      role: "PATRON",
    };

    const result = await pullChanges(otherContext, "party", new Date(0));

    expect(result.records).toEqual([]);

    await prisma.tenant.delete({ where: { id: otherTenantId } });
  });
});
