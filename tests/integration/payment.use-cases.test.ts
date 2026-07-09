import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createTransaction } from "@/application/transaction/create-transaction.use-case";
import { registerPayment } from "@/application/payment/register-payment.use-case";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

describe("registerPayment", () => {
  const tenantId = "test-tenant-payment-usecases";
  const transactionRepository = new PrismaTransactionRepository(tenantId);
  const partyRepository = new PrismaPartyRepository(tenantId);
  const paymentRepository = new PrismaPaymentRepository(tenantId);
  const auditLogger = new PrismaAuditLogger();

  const patronContext: TenantContext = { tenantId, userId: "", role: "PATRON" };
  const vendeurContext: TenantContext = { tenantId, userId: "", role: "VENDEUR" };
  let partyId: string;
  let supplierId: string;

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test payment uc" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999924",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    patronContext.userId = patron.id;
    vendeurContext.userId = patron.id;

    const party = await partyRepository.create(createId(), {
      name: "Fatou Diop",
      phone: "+221771234651",
      type: "CLIENT",
    });
    partyId = party.id;

    const supplier = await partyRepository.create(createId(), {
      name: "Grossiste Kaolack",
      phone: "+221771234652",
      type: "SUPPLIER",
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("un paiement partiel passe la transaction en PARTIELLE et écrit les AuditLog", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "Sac de riz", amount: 10000 },
    );

    const result = await registerPayment(
      vendeurContext,
      { transactionRepository, paymentRepository, auditLogger },
      createId(),
      { transactionId: transaction.id, amount: 4000, method: "WAVE" },
    );

    expect(result.transaction.status).toBe("PARTIELLE");
    expect(result.transaction.paidAmount).toBe(4000);
    expect(result.payment.direction).toBe("IN");
    expect(result.cashMovementId).toBeNull();

    const paymentLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "Payment",
        entityId: result.payment.id,
        action: "payment.created",
      },
    });
    expect(paymentLog).not.toBeNull();

    const transactionLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "Transaction",
        entityId: transaction.id,
        action: "transaction.updated",
      },
    });
    expect(transactionLog).not.toBeNull();
  });

  it("un paiement total passe la transaction en REGLEE", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "Sac de mil", amount: 5000 },
    );

    const result = await registerPayment(
      patronContext,
      { transactionRepository, paymentRepository, auditLogger },
      createId(),
      { transactionId: transaction.id, amount: 5000, method: "AUTRE" },
    );

    expect(result.transaction.status).toBe("REGLEE");
  });

  it("un paiement CASH sur une créance crée un mouvement de caisse ENTREE", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "Sac de sucre", amount: 3000 },
    );

    const result = await registerPayment(
      patronContext,
      { transactionRepository, paymentRepository, auditLogger },
      createId(),
      { transactionId: transaction.id, amount: 3000, method: "CASH" },
    );

    expect(result.cashMovementId).not.toBeNull();
    const cashMovement = await prisma.cashMovement.findUnique({
      where: { id: result.cashMovementId! },
    });
    expect(cashMovement?.type).toBe("ENTREE");
    expect(cashMovement?.linkedPaymentId).toBe(result.payment.id);
  });

  it("un paiement CASH sur une dette crée un mouvement de caisse SORTIE", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository, auditLogger },
      createId(),
      { partyId: supplierId, type: "DETTE", description: "Achat de stock", amount: 8000 },
    );

    const result = await registerPayment(
      patronContext,
      { transactionRepository, paymentRepository, auditLogger },
      createId(),
      { transactionId: transaction.id, amount: 8000, method: "CASH" },
    );

    expect(result.payment.direction).toBe("OUT");
    const cashMovement = await prisma.cashMovement.findUnique({
      where: { id: result.cashMovementId! },
    });
    expect(cashMovement?.type).toBe("SORTIE");
  });

  it("rejette un montant supérieur au solde restant", async () => {
    const transaction = await createTransaction(
      patronContext,
      { repository: transactionRepository, partyRepository, auditLogger },
      createId(),
      { partyId, type: "CREANCE", description: "Test dépassement", amount: 1000 },
    );

    await expect(
      registerPayment(
        patronContext,
        { transactionRepository, paymentRepository, auditLogger },
        createId(),
        { transactionId: transaction.id, amount: 1001, method: "CASH" },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejette une transaction introuvable", async () => {
    await expect(
      registerPayment(
        patronContext,
        { transactionRepository, paymentRepository, auditLogger },
        createId(),
        { transactionId: "transaction-introuvable", amount: 1000, method: "CASH" },
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
