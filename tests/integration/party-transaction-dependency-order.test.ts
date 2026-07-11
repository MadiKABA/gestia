import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { partySyncPayloadSchema } from "@/infrastructure/party/party-mutation.schema";
import { transactionMutationHandler } from "@/infrastructure/transaction/transaction-mutation-handler";
import { transactionSyncPayloadSchema } from "@/infrastructure/transaction/transaction-mutation.schema";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import {
  getMutation,
  listFailedMutations,
  listPendingMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getDb } from "@/infrastructure/offline/db";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { TransactionOfflineRepository } from "@/infrastructure/transaction/transaction-offline.repository";
import { DependencyNotFoundError, ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Régression pour l'interblocage Party -> Transaction : une Transaction
 * créée hors ligne référence un Party créé hors ligne dans la même session
 * (cuid client, pas encore synchronisé). listPendingMutations retombe sur
 * l'ordre IndexedDB (id de mutation, essentiellement aléatoire) quand deux
 * mutations partagent le même `createdAt` à la milliseconde — cas plausible
 * sur un flux "créer client -> créer créance" enchaîné sans confirmation
 * entre les deux. Si la mutation Transaction trie avant celle de Party,
 * sync-engine.ts doit la reporter en fin de cycle (DependencyPendingError)
 * plutôt que de bloquer tout le passage, jusqu'à résolution ou bascule vers
 * l'interface de résolution après MAX_DEPENDENCY_DEFER_CYCLES cycles.
 */
describe("Party hors ligne -> Transaction hors ligne qui le référence : ordre de rejeu", () => {
  const tenantId = "test-tenant-party-tx-dependency-order";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  // Reproduit le catch de syncMutationAction (presentation/offline/actions.ts) :
  // c'est cette conversion qui permet à sync-engine.ts de distinguer une
  // dépendance introuvable d'un échec transitoire ordinaire.
  const syncTransport = async (mutation: QueuedMutation) => {
    try {
      return { ok: true as const, data: await syncMutation(context, { auditLogger }, mutation) };
    } catch (error) {
      if (error instanceof DependencyNotFoundError) {
        return {
          ok: false as const,
          reason: "dependency_not_found" as const,
          message: error.message,
        };
      }
      if (error instanceof ValidationError) {
        return { ok: false as const, reason: "validation_error" as const, message: error.message };
      }
      throw error;
    }
  };

  beforeAll(async () => {
    registerMutationHandler("party", partyMutationHandler);
    registerMutationSchema("party", partySyncPayloadSchema);
    registerMutationHandler("transaction", transactionMutationHandler);
    registerMutationSchema("transaction", transactionSyncPayloadSchema);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant dépendance Party/Transaction" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999950",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { tenantId } });
    await prisma.party.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("createdAt distincts (ordre naturel) : Party puis Transaction se synchronisent en un seul passage", async () => {
    const partyRepo = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const txRepo = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    const party = await partyRepo.create({
      name: "Fatou Diop",
      phone: "+221771111201",
      type: "CLIENT",
    });
    const tx = await txRepo.create({
      partyId: party.id,
      type: "CREANCE",
      description: "Sac de riz",
      amount: 5000,
    });

    const result = await syncQueue({ tenantId, syncTransport });

    expect(result).toEqual({ succeeded: 2, remaining: 0, failed: false });
    expect(await prisma.party.findUnique({ where: { id: party.id } })).not.toBeNull();
    const txInDb = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(txInDb).not.toBeNull();
    expect(txInDb?.partyId).toBe(party.id);
  });

  it("createdAt identique + Transaction triée avant Party (pire ordre) : résolue en un seul appel à syncQueue, jamais bloquée", async () => {
    const partyRepo = new PartyOfflineRepository({ tenantId, userId: context.userId });
    const txRepo = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    const party = await partyRepo.create({
      name: "Moussa Sarr",
      phone: "+221771111202",
      type: "CLIENT",
    });
    const tx = await txRepo.create({
      partyId: party.id,
      type: "CREANCE",
      description: "Sac de mil",
      amount: 3000,
    });

    // Force le pire cas plutôt que d'espérer le reproduire par chance :
    // `createdAt` identique (collision milliseconde) ET l'id de la mutation
    // Transaction forcé à trier avant celui de Party dans l'ordre lexical
    // (clé primaire IndexedDB "id" — l'ordre sur lequel listPendingMutations
    // retombe en cas d'égalité de createdAt, voir mutation-queue.store.ts).
    const db = await getDb();
    const forcedCreatedAt = "2026-07-11T10:00:00.000Z";
    const rawBefore = await db.getAll("mutationQueue");
    for (const record of rawBefore.filter((r) => r.tenantId === tenantId && !r.synced)) {
      await db.delete("mutationQueue", record.id);
      const forcedId =
        record.entity === "transaction" ? "0-forced-transaction-first" : "9-forced-party-second";
      await db.put("mutationQueue", { ...record, id: forcedId, createdAt: forcedCreatedAt });
    }

    const pending = await listPendingMutations(tenantId);
    expect(pending[0].createdAt).toBe(pending[1].createdAt);
    expect(pending[0].entity).toBe("transaction"); // confirme le pire ordre forcé

    const result = await syncQueue({ tenantId, syncTransport });

    // Résolu en un seul passage : Transaction est reportée en fin de cycle
    // (jamais bloquante pour Party), retentée une fois après lui, réussit.
    expect(result).toEqual({ succeeded: 2, remaining: 0, failed: false });
    expect(await prisma.party.findUnique({ where: { id: party.id } })).not.toBeNull();
    const txInDb = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(txInDb).not.toBeNull();
    expect(txInDb?.partyId).toBe(party.id);
    expect(await listFailedMutations(tenantId)).toHaveLength(0);
  });

  it("dépendance qui ne se résout jamais (Party rejeté avant sync) : bascule vers l'interface de résolution après 5 cycles, sans boucler indéfiniment", async () => {
    const txRepo = new TransactionOfflineRepository({ tenantId, userId: context.userId });

    // `partyId` référence un cuid qui n'existera jamais côté serveur (aucune
    // mutation "party" n'est enfilée pour lui) — simule un Party rejeté
    // (ex. payload invalide découvert à la sync) ou supprimé avant d'avoir
    // pu être synchronisé lui-même.
    const neverSyncedPartyId = createId();
    const tx = await txRepo.create({
      partyId: neverSyncedPartyId,
      type: "CREANCE",
      description: "Transaction orpheline",
      amount: 1000,
    });

    const mutation = await getMutation(
      (await listPendingMutations(tenantId)).find((m) => m.clientGeneratedId === tx.id)!.id,
    );
    expect(mutation).toBeDefined();

    // 5 cycles complets : la mutation reste en attente, jamais retirée de
    // listPendingMutations, jamais de mutation fantôme en base.
    for (let cycle = 1; cycle <= 5; cycle++) {
      const result = await syncQueue({ tenantId, syncTransport });
      expect(result.succeeded).toBe(0);
      if (cycle < 5) {
        expect(await listPendingMutations(tenantId)).toHaveLength(1);
        expect(await listFailedMutations(tenantId)).toHaveLength(0);
      }
    }

    // Au 5e cycle : bascule en échec définitif, sort de la boucle de retry
    // automatique, apparaît dans l'interface de résolution avec un message
    // qui la distingue explicitement d'une erreur de validation classique.
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
    const failed = await listFailedMutations(tenantId);
    expect(failed).toHaveLength(1);
    expect(failed[0].entity).toBe("transaction");
    expect(failed[0].syncError).toBe("En attente d'une autre donnée non encore synchronisée");
    expect(await prisma.transaction.findUnique({ where: { id: tx.id } })).toBeNull();

    // Un 6e cycle ne la retente plus jamais automatiquement (exclue de
    // listPendingMutations) : pas de boucle infinie.
    const sixthPass = await syncQueue({ tenantId, syncTransport });
    expect(sixthPass).toEqual({ succeeded: 0, remaining: 0, failed: false });
  });
});
