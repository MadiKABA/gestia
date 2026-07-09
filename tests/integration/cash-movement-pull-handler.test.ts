import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaCashMovementRepository } from "@/infrastructure/cash-movement/cash-movement.repository";
import { createCashMovement } from "@/application/cash-movement/create-cash-movement.use-case";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { cashMovementPullHandler } from "@/infrastructure/cash-movement/cash-movement-pull-handler";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import type { TenantContext } from "@/domain/shared/tenant-context";

/** Gestionnaire de pull de production pour CashMovement — même convention
 * que payment-pull-handler.test.ts. */
describe("cashMovementPullHandler", () => {
  const tenantId = "test-tenant-cash-movement-pull-handler";
  const context: TenantContext = { tenantId, userId: "user-1", role: "PATRON" };
  let repository: PrismaCashMovementRepository;
  const auditLogger = new PrismaAuditLogger();

  beforeAll(async () => {
    registerPullHandler("cashMovement", cashMovementPullHandler);
    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant pull handler cash-movement" },
    });
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999928",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = user.id;

    repository = new PrismaCashMovementRepository(tenantId);
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("renvoie le mouvement créé avec un montant en number", async () => {
    const since = new Date(Date.now() - 1000);
    const movement = await createCashMovement(context, { repository, auditLogger }, createId(), {
      type: "ENTREE",
      amount: 9000,
      reason: "Vente comptant pull",
    });

    const result = await pullChanges(context, "cashMovement", since);

    const record = result.records.find((r) => r.id === movement.id);
    expect(record).toBeDefined();
    const data = record?.data as { amount: number; type: string; reason: string };
    expect(data.amount).toBe(9000);
    expect(typeof data.amount).toBe("number");
    expect(data.type).toBe("ENTREE");
    expect(data.reason).toBe("Vente comptant pull");
  });

  it("ne renvoie rien pour un tenant sans le moindre changement", async () => {
    const otherTenantId = "test-tenant-cash-movement-pull-handler-other";
    await prisma.tenant.create({ data: { id: otherTenantId, name: "Autre tenant" } });
    const otherContext: TenantContext = {
      tenantId: otherTenantId,
      userId: "user-2",
      role: "PATRON",
    };

    const result = await pullChanges(otherContext, "cashMovement", new Date(0));

    expect(result.records).toEqual([]);

    await prisma.tenant.delete({ where: { id: otherTenantId } });
  });
});
