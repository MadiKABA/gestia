import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { updateParty } from "@/application/party/update-party.use-case";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { syncQueue, type SyncTransport } from "@/infrastructure/offline/sync-engine";
import { pullEntity, type PullTransport } from "@/infrastructure/offline/pull-engine";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { getCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { PullHandler } from "@/application/offline/pull-handler";
import type { PartyWithBalance } from "@/application/party/party.repository";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Cycle push -> pull -> fusion complet, contre Postgres réel — couvre ce que
 * les tests unitaires (fake-transport) ne peuvent pas : que le curseur/pull
 * réel réconcilie correctement ce qu'un push vient tout juste d'écrire.
 *
 * Le module Party n'a pas encore de PullHandler de production (retrofit
 * prévu séparément, cf. CLAUDE.md) — ce fichier en enregistre un minimal,
 * local à ce test, pour valider le mécanisme générique de bout en bout sans
 * attendre ce retrofit. Ne fuit jamais dans le code applicatif.
 *
 * Enregistré sous l'entity "party" (pas un nom synthétique) : c'est celle
 * que PartyOfflineRepository utilise déjà en dur côté push/cache local —
 * hasPendingMutationFor (skip du pull sur mutation en attente) corrèle les
 * deux côtés par ce nom, un nom différent romprait silencieusement cette
 * corrélation sans que ça ressemble à un bug de test.
 */
const entity = "party";

function testPartyPullHandler(): PullHandler<PartyWithBalance> {
  return {
    async findChangedSince(context, since, queryStartedAt) {
      const rows = await prisma.party.findMany({
        where: { tenantId: context.tenantId, updatedAt: { gt: since, lte: queryStartedAt } },
        orderBy: { updatedAt: "asc" },
      });
      return {
        records: rows.map((row) => ({
          id: row.id,
          updatedAt: row.updatedAt.toISOString(),
          deletedAt: row.deletedAt?.toISOString() ?? null,
          data: { ...row, balance: 0 },
        })),
      };
    },
  };
}

describe("Cycle de synchronisation bidirectionnel : push -> pull -> fusion", () => {
  const tenantId = "test-tenant-bidirectional-sync";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  const syncTransport: SyncTransport = async (mutation) => ({
    ok: true,
    data: await syncMutation(context, { auditLogger }, mutation),
  });
  const pullTransport: PullTransport = async (input) => ({
    ok: true,
    data: await pullChanges(context, input.entity, new Date(input.since), input.pageCursor),
  });

  beforeAll(async () => {
    registerMutationHandler("party", partyMutationHandler);
    registerPullHandler(entity, testPartyPullHandler());

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant bidirectionnel" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Fatou Ndoye",
        phone: "+221799999903",
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

  it("push puis pull : l'entité tout juste créée par ce client se retrouve dans son propre cache via le pull", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const created = await repository.create({
      name: "Awa Sy",
      phone: "+221771111120",
      type: "CLIENT",
    });

    await syncQueue({ tenantId, syncTransport });
    const pullResult = await pullEntity({ tenantId, entity, pullTransport });

    expect(pullResult.applied).toBeGreaterThanOrEqual(1);
    expect(await getCachedEntity(tenantId, entity, created.id)).not.toBeUndefined();
  });

  it("conflit résolu au push : le pull suivant confirme la valeur gagnante, sans nouveau conflit signalé", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const repositoryPrisma = new PrismaPartyRepository(tenantId);

    const created = await repository.create({
      name: "Modou Diagne",
      phone: "+221771111121",
      type: "SUPPLIER",
    });
    await syncQueue({ tenantId, syncTransport });

    // Autre poste du même tenant modifie directement côté serveur.
    await updateParty(context, { repository: repositoryPrisma, auditLogger }, created.id, {
      name: "Modou Diagne (autre poste)",
      phone: "+221771111121",
      type: "SUPPLIER",
    });

    // Ce client modifie hors ligne, sur la base de l'état connu avant cette
    // modification externe (clientKnownUpdatedAt figé à la dernière sync).
    await repository.update(created.id, {
      name: "Modou Diagne (ce client, hors ligne)",
      phone: "+221771111121",
      type: "SUPPLIER",
    });
    const pushResult = await syncQueue({ tenantId, syncTransport });
    expect(pushResult.failed).toBe(false);

    // Le pull qui suit confirme simplement la valeur qui a gagné au push
    // (dernier-écrit-gagne) — jamais un second conflit détecté côté pull.
    await pullEntity({ tenantId, entity, pullTransport });

    const cached = await getCachedEntity<{ name: string }>(tenantId, entity, created.id);
    expect(cached?.data.name).toBe("Modou Diagne (ce client, hors ligne)");

    const conflictLogs = await prisma.auditLog.count({
      where: { tenantId, entity: "party", entityId: created.id, action: "party.sync_conflict" },
    });
    expect(conflictLogs).toBe(1);
  });

  it("le pull ne remplace pas le cache d'une entité ayant une mutation locale encore en attente", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const repositoryPrisma = new PrismaPartyRepository(tenantId);

    const created = await repository.create({
      name: "Bineta Cissé",
      phone: "+221771111122",
      type: "CLIENT",
    });
    await syncQueue({ tenantId, syncTransport });
    await pullEntity({ tenantId, entity, pullTransport }); // aligne le curseur

    // Modification hors ligne, jamais synchronisée dans ce test.
    await repository.update(created.id, {
      name: "Bineta Cissé (édition locale)",
      phone: "+221771111122",
      type: "CLIENT",
    });

    // Un autre poste modifie aussi côté serveur pendant que ce client est hors ligne.
    await updateParty(context, { repository: repositoryPrisma, auditLogger }, created.id, {
      name: "Bineta Cissé (serveur, autre poste)",
      phone: "+221771111122",
      type: "CLIENT",
    });

    await pullEntity({ tenantId, entity, pullTransport });

    const cached = await getCachedEntity<{ name: string }>(tenantId, entity, created.id);
    expect(cached?.data.name).toBe("Bineta Cissé (édition locale)");

    // Vide la mutation laissée en attente par ce test avant le suivant — ce
    // fichier réutilise le même tenantId d'un test à l'autre (comme
    // party-offline-sync.test.ts), la laisser trainer ferait remonter le
    // compteur "succeeded" du prochain syncQueue().
    await syncQueue({ tenantId, syncTransport });
  });

  it("session expirée puis reconnexion : la mutation en attente n'est jamais perdue et finit par se synchroniser", async () => {
    const repository = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const created = await repository.create({
      name: "Ousmane Fall",
      phone: "+221771111123",
      type: "CLIENT",
    });

    let sessionExpired = true;
    const flakySyncTransport: SyncTransport = async (mutation) => {
      if (sessionExpired) return { ok: false, reason: "auth_required" };
      return { ok: true, data: await syncMutation(context, { auditLogger }, mutation) };
    };

    const firstAttempt = await syncQueue({ tenantId, syncTransport: flakySyncTransport });
    expect(firstAttempt.failed).toBe(true);
    expect(firstAttempt.reason).toBe("auth_required");
    expect(await prisma.party.findUnique({ where: { id: created.id } })).toBeNull();

    // "Reconnexion" : la mutation, jamais retirée de la queue, est reprise
    // sans aucun code de reprise dédié — le prochain cycle la retente
    // simplement comme n'importe quelle mutation en attente.
    sessionExpired = false;
    const secondAttempt = await syncQueue({ tenantId, syncTransport: flakySyncTransport });
    expect(secondAttempt).toEqual({ succeeded: 1, remaining: 0, failed: false });

    expect(await prisma.party.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});
