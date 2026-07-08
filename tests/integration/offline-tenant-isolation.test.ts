import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { partyPullHandler } from "@/infrastructure/party/party-pull-handler";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { syncQueue, type SyncTransport } from "@/infrastructure/offline/sync-engine";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Isolation multi-tenant du pull générique — symétrique aux tests
 * d'isolation déjà en place côté push (TenantScopedRepository). Utilise le
 * PullHandler de production de Party (voir
 * infrastructure/party/party-pull-handler.ts), retrofité sur cette couche.
 *
 * Entity "party" (pas un nom synthétique) : PartyOfflineRepository l'utilise
 * déjà en dur côté push/cache local.
 */
const entity = "party";

describe("Isolation multi-tenant du pull générique", () => {
  const auditLogger = new PrismaAuditLogger();
  const tenantAId = "test-tenant-isolation-a";
  const tenantBId = "test-tenant-isolation-b";
  const tenantCId = "test-tenant-isolation-c";
  const contextA: TenantContext = { tenantId: tenantAId, userId: "", role: "PATRON" };
  const contextB: TenantContext = { tenantId: tenantBId, userId: "", role: "PATRON" };
  const contextC: TenantContext = { tenantId: tenantCId, userId: "", role: "PATRON" };

  beforeAll(async () => {
    registerMutationHandler("party", partyMutationHandler);
    registerPullHandler(entity, partyPullHandler);

    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: "Tenant isolation A" },
        { id: tenantBId, name: "Tenant isolation B" },
        { id: tenantCId, name: "Tenant isolation C" },
      ],
    });
    const [userA, userB, userC] = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenantAId,
          name: "Astou",
          phone: "+221799999910",
          pinHash: "unused",
          role: "PATRON",
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantBId,
          name: "Birame",
          phone: "+221799999911",
          pinHash: "unused",
          role: "PATRON",
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantCId,
          name: "Coumba",
          phone: "+221799999912",
          pinHash: "unused",
          role: "PATRON",
        },
      }),
    ]);
    contextA.userId = userA.id;
    contextB.userId = userB.id;
    contextC.userId = userC.id;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId, tenantCId] } } });
    await prisma.$disconnect();
  });

  it("le pull d'un tenant ne renvoie jamais les entités créées par un autre tenant", async () => {
    const repoA = new PartyOfflineRepository({ tenantId: tenantAId, userId: contextA.userId });
    const repoB = new PartyOfflineRepository({ tenantId: tenantBId, userId: contextB.userId });

    const partyA = await repoA.create({ name: "Client A", phone: "+221771112000", type: "CLIENT" });
    const partyB = await repoB.create({ name: "Client B", phone: "+221771112001", type: "CLIENT" });

    const syncTransportA: SyncTransport = async (m) => ({
      ok: true,
      data: await syncMutation(contextA, { auditLogger }, m),
    });
    const syncTransportB: SyncTransport = async (m) => ({
      ok: true,
      data: await syncMutation(contextB, { auditLogger }, m),
    });
    await syncQueue({ tenantId: tenantAId, syncTransport: syncTransportA });
    await syncQueue({ tenantId: tenantBId, syncTransport: syncTransportB });

    const pullForA = await pullChanges(contextA, entity, new Date(0));
    const pullForB = await pullChanges(contextB, entity, new Date(0));

    const idsForA = pullForA.records.map((r) => r.id);
    const idsForB = pullForB.records.map((r) => r.id);

    expect(idsForA).toContain(partyA.id);
    expect(idsForA).not.toContain(partyB.id);
    expect(idsForB).toContain(partyB.id);
    expect(idsForB).not.toContain(partyA.id);
  });

  it("un tenant jamais touché par aucune mutation ne reçoit jamais rien, même après des écritures massives sur d'autres tenants", async () => {
    const repoA = new PartyOfflineRepository({ tenantId: tenantAId, userId: contextA.userId });
    const syncTransportA: SyncTransport = async (m) => ({
      ok: true,
      data: await syncMutation(contextA, { auditLogger }, m),
    });
    await repoA.create({ name: "Client A bis", phone: "+221771112002", type: "CLIENT" });
    await syncQueue({ tenantId: tenantAId, syncTransport: syncTransportA });

    // tenantC n'a jamais eu la moindre écriture — le pull générique ne doit
    // jamais lui renvoyer quoi que ce soit, quel que soit le volume de
    // données créées entre-temps pour A et B (voir le test précédent).
    const pullForC = await pullChanges(contextC, entity, new Date(0));
    expect(pullForC.records).toEqual([]);
  });
});
