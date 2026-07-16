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
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { CashMovementOfflineRepository } from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { partySyncPayloadSchema } from "@/infrastructure/party/party-mutation.schema";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { ValidationError, ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Test d'intégration bout-en-bout du module CashMovement offline-first —
 * même structure que payment-offline-sync.test.ts. Pas de dépendance à une
 * autre entité en cache (contrairement à Payment/transaction) : un mouvement
 * de caisse manuel est autonome.
 */
describe("CashMovement offline-first : bout en bout", () => {
  const tenantId = "test-tenant-cash-movement-offline";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("cashMovement", cashMovementMutationHandler);
    registerMutationSchema("cashMovement", cashMovementSyncPayloadSchema);
    registerMutationHandler("party", partyMutationHandler);
    registerMutationSchema("party", partySyncPayloadSchema);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant de test offline cash-movement" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999927",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("crée un mouvement hors ligne : absent en base avant sync, présent avec AuditLog après", async () => {
    const repository = new CashMovementOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      type: "ENTREE",
      amount: 15000,
      reason: "Vente comptant",
    });

    expect(await prisma.cashMovement.findUnique({ where: { id: created.id } })).toBeNull();

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.cashMovement.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.amount.toNumber()).toBe(15000);
    expect(inDb?.type).toBe("ENTREE");
    expect(inDb?.linkedPaymentId).toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "CashMovement",
        entityId: created.id,
        action: "cash-movement.created",
      },
    });
    expect(log).not.toBeNull();
  });

  it("vente au comptant créée hors ligne : partyId/method préservés après sync", async () => {
    const partyRepo = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const party = await partyRepo.create({
      name: "Fatou Diop",
      phone: "+221771111303",
      type: "CLIENT",
    });

    const repository = new CashMovementOfflineRepository({ tenantId, userId: context.userId });
    const created = await repository.create({
      type: "ENTREE",
      amount: 12000,
      reason: "2 sacs de riz",
      method: "WAVE",
      partyId: party.id,
    });

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result.failed).toBe(false);

    const inDb = await prisma.cashMovement.findUnique({ where: { id: created.id } });
    expect(inDb?.partyId).toBe(party.id);
    expect(inDb?.method).toBe("WAVE");
  });

  it("retry d'un mouvement déjà appliqué : rejoué sans erreur, sans doublon", async () => {
    const repository = new CashMovementOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      type: "SORTIE",
      amount: 2500,
      reason: "Achat fournitures",
    });

    const mutation: QueuedMutation = {
      id: "mutation-cash-movement-1",
      tenantId,
      entity: "cashMovement",
      action: "create",
      payload: { type: "SORTIE", amount: 2500, reason: "Achat fournitures" },
      clientGeneratedId: created.id,
      createdAt: new Date().toISOString(),
      createdById: context.userId,
    };

    const firstAttempt = await syncTransport(mutation);
    const secondAttempt = await syncTransport(mutation);

    expect(secondAttempt.data.updatedAt).toBe(firstAttempt.data.updatedAt);
    expect(await prisma.cashMovement.count({ where: { tenantId, id: created.id } })).toBe(1);
  });

  it("reprise après fermeture de l'app : la queue persistée en IndexedDB est rejouée indépendamment de tout état en mémoire", async () => {
    const repository = new CashMovementOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      type: "ENTREE",
      amount: 8000,
      reason: "Dépôt initial",
    });
    // Jamais synchronisé ici — simule l'app fermée avant la sync.

    const pendingAfterReload = await listPendingMutations(tenantId);
    expect(pendingAfterReload.some((m) => m.clientGeneratedId === created.id)).toBe(true);

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result.failed).toBe(false);

    expect(await prisma.cashMovement.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  it("rejette un payload invalide (montant négatif) avec une ValidationError propre, sans jamais écrire en base", async () => {
    const rejectedId = "cash-movement-payload-invalide-test";

    await expect(
      syncTransport({
        id: "mutation-payload-invalide-cash-movement",
        tenantId,
        entity: "cashMovement",
        action: "create",
        payload: { type: "ENTREE", amount: -100, reason: "Motif" },
        clientGeneratedId: rejectedId,
        createdAt: new Date().toISOString(),
        createdById: context.userId,
      }),
    ).rejects.toThrow(ValidationError);

    expect(await prisma.cashMovement.findUnique({ where: { id: rejectedId } })).toBeNull();
  });

  it("refuse un mouvement créé par un vendeur (réservé au patron), sans jamais écrire en base", async () => {
    const rejectedId = "cash-movement-vendeur-test";
    const vendeurContext: TenantContext = { tenantId, userId: context.userId, role: "VENDEUR" };

    await expect(
      syncMutation(
        vendeurContext,
        { auditLogger },
        {
          id: "mutation-vendeur-cash-movement",
          tenantId,
          entity: "cashMovement",
          action: "create",
          payload: { type: "ENTREE", amount: 1000, reason: "Motif" },
          clientGeneratedId: rejectedId,
          createdAt: new Date().toISOString(),
          createdById: context.userId,
        },
      ),
    ).rejects.toThrow(ForbiddenError);

    expect(await prisma.cashMovement.findUnique({ where: { id: rejectedId } })).toBeNull();
  });
});
