import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CashMovementOfflineRepository } from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { seedOrReadCashBalanceCache } from "@/presentation/cash-movement/offline-repository";
import { clearAllOfflineData } from "@/infrastructure/offline/db";
import type { CashBalance } from "@/application/cash-movement/cash-movement.repository";

/**
 * Régression pour l'absence de patch optimiste sur la page Caisse : un
 * mouvement créé hors ligne (ou en ligne) doit se refléter immédiatement
 * dans le cache local du solde agrégé (`CASH_BALANCE_ENTITY`), lu par
 * `seedOrReadCashBalanceCache` — sans quoi la page Caisse restait figée sur
 * le solde du dernier rendu serveur jusqu'au prochain rechargement en ligne.
 */
describe("CashMovementOfflineRepository — cache optimiste du solde agrégé", () => {
  const tenantId = "test-tenant-cash-balance-cache";
  const userId = "user-1";

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", { value, configurable: true });
  }

  beforeEach(async () => {
    await clearAllOfflineData();
  });

  afterEach(() => {
    setOnline(true);
  });

  it("mouvement créé hors ligne : patché dans le cache du solde sans attendre la sync", async () => {
    setOnline(false);
    const repository = new CashMovementOfflineRepository({ tenantId, userId });

    await repository.create({ type: "ENTREE", amount: 20000, reason: "Vente" });
    await repository.create({ type: "SORTIE", amount: 5000, reason: "Achat" });

    // Simule l'arrivée sur /caisse hors ligne : ne doit jamais écraser le
    // cache déjà patché avec une valeur SSR figée.
    const balance = await seedOrReadCashBalanceCache(tenantId, { totalEntree: 0, totalSortie: 0 });

    expect(balance).toEqual<CashBalance>({ totalEntree: 20000, totalSortie: 5000 });
  });

  it("en ligne : le solde rendu par le serveur écrase le cache (source de vérité la plus fraîche)", async () => {
    setOnline(false);
    const repository = new CashMovementOfflineRepository({ tenantId, userId });
    await repository.create({ type: "ENTREE", amount: 1000, reason: "Vente hors ligne" });

    setOnline(true);
    // Le prochain montage de /caisse, en ligne cette fois, doit refléter la
    // vraie valeur serveur (déjà synchronisée entre-temps par hypothèse),
    // jamais rester bloqué sur une valeur locale périmée.
    const balance = await seedOrReadCashBalanceCache(tenantId, {
      totalEntree: 1000,
      totalSortie: 500,
    });

    expect(balance).toEqual<CashBalance>({ totalEntree: 1000, totalSortie: 500 });
  });

  it("aucun cache existant, hors ligne (première visite) : replie sur le solde initial fourni", async () => {
    setOnline(false);
    const balance = await seedOrReadCashBalanceCache(tenantId, {
      totalEntree: 7000,
      totalSortie: 2000,
    });

    expect(balance).toEqual<CashBalance>({ totalEntree: 7000, totalSortie: 2000 });
  });
});
