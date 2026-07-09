import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Régression pour le bug "paiement réussi puis redevenu impayé au
 * rafraîchissement" : registerPaymentSync() n'était appelé que dans
 * instrumentation.ts, jamais dans presentation/offline/actions.ts ni
 * app/api/sync/route.ts — les deux modules qui exécutent réellement les
 * mutations/pull en production (Next.js bundle instrumentation.ts dans un
 * graphe de modules séparé, voir le commentaire dans actions.ts). Ce test
 * importe chacun de ces deux modules en isolation (vi.resetModules) et
 * vérifie que les trois registres génériques (schéma Zod, handler de
 * mutation, handler de pull) sont bien peuplés pour toute entity synchronisée
 * — pas seulement testable via instrumentation.ts, qui ne protège rien en
 * production.
 */

const SYNCED_ENTITIES = ["party", "transaction", "payment"];

async function assertAllEntitiesRegistered() {
  const { getMutationHandler } = await import("@/application/offline/mutation-handler-registry");
  const { getMutationSchema } = await import("@/application/offline/mutation-schema-registry");
  const { getPullHandler } = await import("@/application/offline/pull-handler-registry");

  for (const entity of SYNCED_ENTITIES) {
    expect(getMutationHandler(entity), `mutation handler manquant pour "${entity}"`).toBeDefined();
    expect(getMutationSchema(entity), `schéma Zod manquant pour "${entity}"`).toBeDefined();
    expect(getPullHandler(entity), `pull handler manquant pour "${entity}"`).toBeDefined();
  }
}

describe("Câblage des registres génériques de sync dans les modules réellement exécutés", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("importer presentation/offline/actions.ts enregistre les 3 registres pour party/transaction/payment", async () => {
    await import("@/presentation/offline/actions");
    await assertAllEntitiesRegistered();
  });

  it("importer app/api/sync/route.ts enregistre les 3 registres pour party/transaction/payment", async () => {
    await import("@/app/api/sync/route");
    await assertAllEntitiesRegistered();
  });
});
