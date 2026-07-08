import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { updateParty } from "@/application/party/update-party.use-case";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Test d'intégration bout-en-bout du retrofit offline-first de Party :
 * PartyOfflineRepository (cache local + queue) -> syncQueue -> syncMutation
 * -> partyMutationHandler -> use cases createParty/updateParty existants
 * -> Postgres réel. Couvre les trois scénarios critiques du cahier des
 * charges §9 (aucune mutation perdue, dernier-écrit-gagne tracé, reprise
 * après "fermeture" de l'app).
 */
describe("Party offline-first : bout en bout", () => {
  const tenantId = "test-tenant-party-offline";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  // Transport de sync réel : appelle syncMutation directement (équivalent de
  // ce que fait syncMutationAction, sans passer par le réseau/la session),
  // enveloppé en { ok: true } comme le fait réellement syncMutationAction.
  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("party", partyMutationHandler);

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test offline" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999902",
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

  it("créer hors ligne : visible immédiatement en local, puis synchronisé avec AuditLog", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      name: "Fatou Diop",
      phone: "+221771111111",
      type: "CLIENT",
    });

    // Visible immédiatement dans le cache local, avant toute synchronisation.
    const localList = await repository.list({});
    expect(localList.map((p) => p.id)).toContain(created.id);
    expect(await prisma.party.findUnique({ where: { id: created.id } })).toBeNull();

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.party.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.name).toBe("Fatou Diop");
    // Le client-generated id devient l'id définitif — jamais remplacé à la sync.
    expect(inDb?.id).toBe(created.id);

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Party", entityId: created.id, action: "party.created" },
    });
    expect(log).not.toBeNull();
  });

  it("conflit dernier-écrit-gagne : écrase la valeur serveur et trace une seule entrée AuditLog", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const repositoryPrisma = new PrismaPartyRepository(tenantId);

    // Créé et synchronisé une première fois (état de référence connu du client).
    const created = await repository.create({
      name: "Moussa Sarr",
      phone: "+221771111112",
      type: "SUPPLIER",
    });
    await syncQueue({ tenantId, syncTransport });

    // "Session 2" (autre appareil) modifie directement côté serveur pendant
    // que "session 1" reste hors ligne avec son propre changement en attente.
    await updateParty(context, { repository: repositoryPrisma, auditLogger }, created.id, {
      name: "Moussa Sarr (modifié par session 2)",
      phone: "+221771111112",
      type: "SUPPLIER",
    });

    // "Session 1" modifie hors ligne, sur la base de l'état connu avant le
    // changement de session 2 (clientKnownUpdatedAt figé dans le cache local
    // au moment de la première synchronisation).
    await repository.update(created.id, {
      name: "Moussa Sarr (modifié par session 1, hors ligne)",
      phone: "+221771111112",
      type: "SUPPLIER",
    });

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    // Dernier écrit gagne : la valeur de session 1 (la plus récemment
    // synchronisée) l'emporte dans la base.
    const inDb = await prisma.party.findUnique({ where: { id: created.id } });
    expect(inDb?.name).toBe("Moussa Sarr (modifié par session 1, hors ligne)");

    const conflictLogs = await prisma.auditLog.findMany({
      where: { tenantId, entity: "party", entityId: created.id, action: "party.sync_conflict" },
    });
    expect(conflictLogs).toHaveLength(1);
    expect((conflictLogs[0].oldData as { name: string }).name).toBe(
      "Moussa Sarr (modifié par session 2)",
    );
    expect((conflictLogs[0].newData as { name: string }).name).toBe(
      "Moussa Sarr (modifié par session 1, hors ligne)",
    );
  });

  it("retry d'une création déjà appliquée côté serveur (réponse jamais reçue par le client) : rejoué sans erreur, aucun doublon", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      name: "Bineta Fall",
      phone: "+221771111114",
      type: "CLIENT",
    });

    // Simule la même mutation envoyée deux fois par le moteur de sync — cas
    // réel : la première tentative a bien créé le Party côté serveur, mais
    // la réponse ne nous est jamais parvenue (coupure réseau), donc la
    // mutation reste en attente et le moteur la retente.
    const firstAttempt = await syncTransport({
      id: "mutation-1",
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "Bineta Fall", phone: "+221771111114", type: "CLIENT" },
      clientGeneratedId: created.id,
      createdAt: new Date().toISOString(),
      createdById: context.userId,
    });
    const secondAttempt = await syncTransport({
      id: "mutation-1",
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "Bineta Fall", phone: "+221771111114", type: "CLIENT" },
      clientGeneratedId: created.id,
      createdAt: new Date().toISOString(),
      createdById: context.userId,
    });

    expect(secondAttempt.data.updatedAt).toBe(firstAttempt.data.updatedAt);
    expect(await prisma.party.count({ where: { tenantId, id: created.id } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { tenantId, entity: "Party", entityId: created.id, action: "party.created" },
      }),
    ).toBe(1);
  });

  it("reprise après fermeture de l'app : la queue persistée en IndexedDB est rejouée indépendamment de tout état en mémoire", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      name: "Khady Sow",
      phone: "+221771111113",
      type: "CLIENT",
    });
    // Jamais synchronisé ici — simule l'app fermée avant la sync.

    // "Rechargement" : nouvelle lecture de la queue depuis IndexedDB, sans
    // réutiliser aucun état en mémoire de l'étape précédente.
    const pendingAfterReload = await listPendingMutations(tenantId);
    expect(pendingAfterReload.some((m) => m.clientGeneratedId === created.id)).toBe(true);

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result.failed).toBe(false);

    const inDb = await prisma.party.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });
});
