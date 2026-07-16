import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaCashMovementRepository } from "@/infrastructure/cash-movement/cash-movement.repository";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { createCashMovement } from "@/application/cash-movement/create-cash-movement.use-case";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { DependencyNotFoundError, ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Couverture de la vente au comptant côté use case : `partyId` optionnel,
 * vérifié seulement s'il est fourni (contrairement à Transaction où il est
 * obligatoire) — même pattern que create-transaction.use-case.ts sinon.
 */
describe("createCashMovement — partyId optionnel (vente au comptant)", () => {
  const tenantId = "test-tenant-cash-movement-use-cases";
  const otherTenantId = "test-tenant-cash-movement-use-cases-other";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };
  let repository: PrismaCashMovementRepository;
  let partyRepository: PrismaPartyRepository;
  let clientId: string;
  let otherTenantClientId: string;

  beforeAll(async () => {
    await prisma.tenant.createMany({
      data: [
        { id: tenantId, name: "Tenant vente au comptant" },
        { id: otherTenantId, name: "Autre tenant" },
      ],
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999940",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;

    const client = await prisma.party.create({
      data: { tenantId, name: "Fatou Diop", phone: "+221771111301", type: "CLIENT" },
    });
    clientId = client.id;

    const otherClient = await prisma.party.create({
      data: {
        tenantId: otherTenantId,
        name: "Moussa Sarr",
        phone: "+221771111302",
        type: "CLIENT",
      },
    });
    otherTenantClientId = otherClient.id;

    repository = new PrismaCashMovementRepository(tenantId);
    partyRepository = new PrismaPartyRepository(tenantId);
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({ where: { tenantId } });
    await prisma.party.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await prisma.$disconnect();
  });

  it("accepte une vente sans client (partyId absent)", async () => {
    const movement = await createCashMovement(
      context,
      { repository, partyRepository, auditLogger },
      createId(),
      { type: "ENTREE", amount: 5000, reason: "2 sacs de riz", method: "CASH" },
    );

    expect(movement.partyId).toBeNull();
    expect(movement.method).toBe("CASH");
  });

  it("accepte une vente avec un client existant du même tenant", async () => {
    const movement = await createCashMovement(
      context,
      { repository, partyRepository, auditLogger },
      createId(),
      {
        type: "ENTREE",
        amount: 3000,
        reason: "Coupe de cheveux",
        method: "WAVE",
        partyId: clientId,
      },
    );

    expect(movement.partyId).toBe(clientId);

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "CashMovement",
        entityId: movement.id,
        action: "cash-movement.created",
      },
    });
    expect(log).not.toBeNull();
    expect((log?.newData as { partyId: string | null })?.partyId).toBe(clientId);
  });

  it("rejette un partyId inconnu du tenant (DependencyNotFoundError)", async () => {
    await expect(
      createCashMovement(context, { repository, partyRepository, auditLogger }, createId(), {
        type: "ENTREE",
        amount: 1000,
        reason: "Vente",
        partyId: createId(),
      }),
    ).rejects.toThrow(DependencyNotFoundError);
  });

  it("rejette un partyId appartenant à un autre tenant (isolation)", async () => {
    await expect(
      createCashMovement(context, { repository, partyRepository, auditLogger }, createId(), {
        type: "ENTREE",
        amount: 1000,
        reason: "Vente",
        partyId: otherTenantClientId,
      }),
    ).rejects.toThrow(DependencyNotFoundError);
  });

  it("refuse toujours un vendeur (réservé au patron, comportement inchangé)", async () => {
    const vendeurContext: TenantContext = { tenantId, userId: context.userId, role: "VENDEUR" };

    await expect(
      createCashMovement(vendeurContext, { repository, partyRepository, auditLogger }, createId(), {
        type: "ENTREE",
        amount: 1000,
        reason: "Vente",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
