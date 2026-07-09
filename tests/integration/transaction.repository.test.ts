import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";

/**
 * Test d'intégration (couche infrastructure) contre un Postgres réel — même
 * convention que party.repository.test.ts. Couvre en plus les
 * particularités propres à Transaction : génération de référence via
 * Sequence (y compris sous concurrence), agrégation de solde, détection de
 * transactions ouvertes.
 */
describe("PrismaTransactionRepository", () => {
  const tenantId = "test-tenant-transaction-repo";
  let repository: PrismaTransactionRepository;
  let partyRepository: PrismaPartyRepository;
  let userId: string;
  let partyId: string;

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test transaction" } });
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999920",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    userId = user.id;

    repository = new PrismaTransactionRepository(tenantId);
    partyRepository = new PrismaPartyRepository(tenantId);
    const party = await partyRepository.create(createId(), {
      name: "Fatou Diop",
      phone: "+221771234567",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("crée une créance avec référence CR-<année>-XXXXX générée automatiquement", async () => {
    const created = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz 50kg", amount: 15000 },
      userId,
    );

    expect(created.reference).toMatch(/^CR-\d{4}-\d{5}$/);
    expect(created.status).toBe("EN_COURS");
    expect(created.paidAmount).toBe(0);
    expect(created.amount).toBe(15000);
  });

  it("crée une dette avec référence DT-<année>-XXXXX", async () => {
    const created = await repository.create(
      createId(),
      { partyId, type: "DETTE", description: "Service de transport", amount: 5000 },
      userId,
    );

    expect(created.reference).toMatch(/^DT-\d{4}-\d{5}$/);
  });

  it("incrémente le compteur de référence à chaque création du même type", async () => {
    const first = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Article A", amount: 1000 },
      userId,
    );
    const second = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Article B", amount: 2000 },
      userId,
    );

    const counterOf = (reference: string) => Number(reference.split("-")[2]);
    expect(counterOf(second.reference!)).toBe(counterOf(first.reference!) + 1);
  });

  it("attribue des références uniques sous création concurrente (race sur Sequence)", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repository.create(
          createId(),
          { partyId, type: "DETTE", description: `Concurrence ${i}`, amount: 100 },
          userId,
        ),
      ),
    );

    const references = results.map((r) => r.reference);
    expect(new Set(references).size).toBe(5);
  });

  it("met à jour une transaction sans jamais permettre de payer avant terme", async () => {
    const created = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Avant modification", amount: 1000 },
      userId,
    );

    const updated = await repository.update(created.id, {
      type: "CREANCE",
      description: "Après modification",
      amount: 3000,
    });

    expect(updated.description).toBe("Après modification");
    expect(updated.amount).toBe(3000);
    expect(updated.reference).toBe(created.reference);
    expect(updated.status).toBe("EN_COURS");
  });

  it("soft delete puis exclut des recherches et de findById", async () => {
    const created = await repository.create(
      createId(),
      { partyId, type: "CREANCE", description: "À supprimer", amount: 500 },
      userId,
    );

    await repository.delete(created.id);

    expect(await repository.findById(created.id)).toBeNull();
    const results = await repository.findMany({ partyId });
    expect(results.map((t) => t.id)).not.toContain(created.id);
  });

  describe("aggregateBalancesByParty", () => {
    it("solde net signé : CREANCE positive, DETTE négative", async () => {
      const balanceTenantId = "test-tenant-transaction-balance";
      await prisma.tenant.create({ data: { id: balanceTenantId, name: "Tenant solde" } });
      const balanceUser = await prisma.user.create({
        data: {
          tenantId: balanceTenantId,
          name: "Moussa Sarr",
          phone: "+221799999921",
          pinHash: "unused",
          role: "PATRON",
        },
      });
      const balanceParty = await new PrismaPartyRepository(balanceTenantId).create(createId(), {
        name: "Client solde",
        phone: "+221771234620",
        type: "CLIENT",
      });
      const balanceRepository = new PrismaTransactionRepository(balanceTenantId);

      await balanceRepository.create(
        createId(),
        { partyId: balanceParty.id, type: "CREANCE", description: "Vente", amount: 20000 },
        balanceUser.id,
      );
      await balanceRepository.create(
        createId(),
        { partyId: balanceParty.id, type: "DETTE", description: "Achat", amount: 5000 },
        balanceUser.id,
      );

      const balances = await balanceRepository.aggregateBalancesByParty([balanceParty.id]);

      expect(balances.get(balanceParty.id)).toBe(15000);

      await prisma.tenant.delete({ where: { id: balanceTenantId } });
    });

    it("retourne une map vide pour une liste de partyIds vide", async () => {
      const balances = await repository.aggregateBalancesByParty([]);
      expect(balances.size).toBe(0);
    });
  });

  describe("hasOpenTransactionsForParty", () => {
    it("faux quand le tiers n'a aucune transaction", async () => {
      const openTenantId = "test-tenant-transaction-open";
      await prisma.tenant.create({ data: { id: openTenantId, name: "Tenant ouvert" } });
      const openParty = await new PrismaPartyRepository(openTenantId).create(createId(), {
        name: "Client sans transaction",
        phone: "+221771234630",
        type: "CLIENT",
      });

      const openRepository = new PrismaTransactionRepository(openTenantId);
      expect(await openRepository.hasOpenTransactionsForParty(openParty.id)).toBe(false);

      await prisma.tenant.delete({ where: { id: openTenantId } });
    });

    it("vrai quand le tiers a une transaction EN_COURS", async () => {
      const created = await repository.create(
        createId(),
        { partyId, type: "CREANCE", description: "Test blocage", amount: 1000 },
        userId,
      );

      expect(await repository.hasOpenTransactionsForParty(partyId)).toBe(true);

      await repository.delete(created.id);
    });

    it("faux une fois la transaction réglée (statut REGLEE)", async () => {
      // Tenant/tiers dédiés : `partyId` (partagé par ce describe) accumule
      // des transactions EN_COURS créées par les tests précédents du
      // fichier, ce qui fausserait cette assertion.
      const settledTenantId = "test-tenant-transaction-settled";
      await prisma.tenant.create({ data: { id: settledTenantId, name: "Tenant réglé" } });
      const settledUser = await prisma.user.create({
        data: {
          tenantId: settledTenantId,
          name: "Khady Sow",
          phone: "+221799999922",
          pinHash: "unused",
          role: "PATRON",
        },
      });
      const settledParty = await new PrismaPartyRepository(settledTenantId).create(createId(), {
        name: "Client réglé",
        phone: "+221771234640",
        type: "CLIENT",
      });
      const settledRepository = new PrismaTransactionRepository(settledTenantId);

      const created = await settledRepository.create(
        createId(),
        { partyId: settledParty.id, type: "CREANCE", description: "Test réglé", amount: 1000 },
        settledUser.id,
      );
      // Payment n'existe pas encore (hors périmètre) : le statut REGLEE est
      // simulé directement en base pour tester cette requête isolément.
      await prisma.transaction.update({
        where: { id: created.id },
        data: { status: "REGLEE" },
      });

      expect(await settledRepository.hasOpenTransactionsForParty(settledParty.id)).toBe(false);

      await prisma.tenant.delete({ where: { id: settledTenantId } });
    });
  });
});
