import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerPayment } from "@/application/payment/register-payment.use-case";
import { paymentPullHandler } from "@/infrastructure/payment/payment-pull-handler";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Gestionnaire de pull de production pour Payment — même convention que
 * transaction-pull-handler.test.ts.
 */
describe("paymentPullHandler", () => {
  const tenantId = "test-tenant-payment-pull-handler";
  const context: TenantContext = { tenantId, userId: "user-1", role: "PATRON" };
  let transactionRepository: PrismaTransactionRepository;
  let paymentRepository: PrismaPaymentRepository;
  const auditLogger = new PrismaAuditLogger();
  let partyId: string;

  beforeAll(async () => {
    registerPullHandler("payment", paymentPullHandler);
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant pull handler payment" } });
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999927",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = user.id;

    transactionRepository = new PrismaTransactionRepository(tenantId);
    paymentRepository = new PrismaPaymentRepository(tenantId);
    const party = await new PrismaPartyRepository(tenantId).create(createId(), {
      name: "Tiers pull payment",
      phone: "+221771234690",
      type: "CLIENT",
    });
    partyId = party.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("renvoie le paiement créé avec un montant en number", async () => {
    const since = new Date(Date.now() - 1000);
    const transaction = await transactionRepository.create(
      createId(),
      { partyId, type: "CREANCE", description: "Transaction pull payment", amount: 12000 },
      context.userId,
    );
    const { payment } = await registerPayment(
      context,
      { transactionRepository, paymentRepository, auditLogger },
      createId(),
      { transactionId: transaction.id, amount: 5000, method: "WAVE" },
    );

    const result = await pullChanges(context, "payment", since);

    const record = result.records.find((r) => r.id === payment.id);
    expect(record).toBeDefined();
    const data = record?.data as { amount: number; transactionId: string };
    expect(data.amount).toBe(5000);
    expect(typeof data.amount).toBe("number");
    expect(data.transactionId).toBe(transaction.id);
  });

  it("ne renvoie rien pour un tenant sans le moindre changement", async () => {
    const otherTenantId = "test-tenant-payment-pull-handler-other";
    await prisma.tenant.create({ data: { id: otherTenantId, name: "Autre tenant" } });
    const otherContext: TenantContext = {
      tenantId: otherTenantId,
      userId: "user-2",
      role: "PATRON",
    };

    const result = await pullChanges(otherContext, "payment", new Date(0));

    expect(result.records).toEqual([]);

    await prisma.tenant.delete({ where: { id: otherTenantId } });
  });
});
