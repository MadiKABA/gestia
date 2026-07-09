import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";

/**
 * Test d'intégration (couche infrastructure) contre un Postgres réel — même
 * convention que transaction.repository.test.ts. Couvre l'écriture atomique
 * propre à `register` : Payment + Transaction.paidAmount/status + CashMovement
 * en une seule transaction Prisma.
 */
describe("PrismaPaymentRepository", () => {
  const tenantId = "test-tenant-payment-repo";
  let transactionRepository: PrismaTransactionRepository;
  let paymentRepository: PrismaPaymentRepository;
  let userId: string;
  let partyId: string;

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test payment" } });
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999925",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    userId = user.id;

    transactionRepository = new PrismaTransactionRepository(tenantId);
    paymentRepository = new PrismaPaymentRepository(tenantId);
    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Fatou Diop",
      phone: "+221771234660",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("register écrit Payment, met à jour Transaction et crée le CashMovement lié", async () => {
    const transaction = await transactionRepository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz", amount: 10000 },
      userId,
    );

    const result = await paymentRepository.register(
      createId(),
      {
        transactionId: transaction.id,
        amount: 6000,
        method: "CASH",
        direction: "IN",
        note: null,
        newPaidAmount: 6000,
        newStatus: "PARTIELLE",
        cashMovement: { type: "ENTREE", reason: "Paiement — " + transaction.reference },
      },
      userId,
    );

    expect(result.transaction.paidAmount).toBe(6000);
    expect(result.transaction.status).toBe("PARTIELLE");
    expect(result.cashMovementId).not.toBeNull();

    const found = await paymentRepository.findById(result.payment.id);
    expect(found?.amount).toBe(6000);

    const history = await paymentRepository.findByTransactionId(transaction.id);
    expect(history).toHaveLength(1);
  });

  it("register sans méthode CASH ne crée aucun CashMovement", async () => {
    const transaction = await transactionRepository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Sac de mil", amount: 4000 },
      userId,
    );

    const result = await paymentRepository.register(
      createId(),
      {
        transactionId: transaction.id,
        amount: 4000,
        method: "WAVE",
        direction: "IN",
        note: null,
        newPaidAmount: 4000,
        newStatus: "REGLEE",
        cashMovement: null,
      },
      userId,
    );

    expect(result.cashMovementId).toBeNull();
  });
});
