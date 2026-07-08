import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";

/**
 * Test d'intégration (couche infrastructure) : nécessite un Postgres local
 * accessible via DATABASE_URL (voir README "Installation locale"). Crée son
 * propre tenant de test et nettoie après exécution.
 */
describe("PrismaPartyRepository", () => {
  const tenantId = "test-tenant-party-repo";
  let repository: PrismaPartyRepository;

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test" } });
    repository = new PrismaPartyRepository(tenantId);
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("crée un tiers puis le retrouve par recherche", async () => {
    const created = await repository.create(createId(), {
      name: "Fatou Diop",
      phone: "+221771234567",
      type: "CLIENT",
    });

    const results = await repository.findMany({ search: "Fatou" });

    expect(results.map((p) => p.id)).toContain(created.id);
  });

  it("ne retourne jamais un tiers d'un autre tenant", async () => {
    const otherTenantId = "test-tenant-party-repo-other";
    await prisma.tenant.create({ data: { id: otherTenantId, name: "Autre tenant" } });
    const otherParty = await prisma.party.create({
      data: { tenantId: otherTenantId, name: "Tiers isolé", type: "CLIENT" },
    });

    const found = await repository.findById(otherParty.id);

    expect(found).toBeNull();

    await prisma.party.delete({ where: { id: otherParty.id } });
    await prisma.tenant.delete({ where: { id: otherTenantId } });
  });

  it("exclut un tiers soft-deleted des recherches et de findById", async () => {
    const created = await repository.create(createId(), {
      name: "Tiers à supprimer",
      phone: "+221771234599",
      type: "CLIENT",
    });

    await repository.delete(created.id);

    expect(await repository.findById(created.id)).toBeNull();
    const results = await repository.findMany({ search: "Tiers à supprimer" });
    expect(results.map((p) => p.id)).not.toContain(created.id);
  });

  describe("findChangedSince (réservé au PullHandler de synchronisation descendante)", () => {
    it("inclut un tiers soft-deleted plutôt que de le filtrer", async () => {
      const created = await repository.create(createId(), {
        name: "Tiers pull soft-delete",
        phone: "+221771234511",
        type: "CLIENT",
      });
      const since = new Date(Date.now() - 1000);
      await repository.delete(created.id);
      const queryStartedAt = new Date();

      const rows = await repository.findChangedSince(since, queryStartedAt, undefined, 100);

      const match = rows.find((row) => row.id === created.id);
      expect(match).toBeDefined();
      expect(match?.deletedAt).not.toBeNull();
    });

    it("exclut un tiers modifié avant `since` ou après `queryStartedAt`", async () => {
      const since = new Date();
      const created = await repository.create(createId(), {
        name: "Tiers pull hors fenêtre",
        phone: "+221771234512",
        type: "CLIENT",
      });
      const queryStartedAt = new Date();

      // Modifié après queryStartedAt : ne doit pas apparaître dans ce cycle,
      // sera repris par le prochain (borne haute stable par cycle de pull).
      await repository.update(created.id, {
        name: "Tiers pull hors fenêtre (modifié après)",
        phone: "+221771234512",
        type: "CLIENT",
      });

      const rows = await repository.findChangedSince(since, queryStartedAt, undefined, 100);

      expect(rows.some((row) => row.id === created.id)).toBe(false);
    });

    it("pagine par curseur (updatedAt, id) sans trou ni doublon entre deux pages", async () => {
      // Tenant dédié : évite qu'un tiers créé par un test précédent de ce
      // fichier (même tenant, même fenêtre `since` glissante d'une seconde)
      // ne fausse le compte exact de lignes attendues sur cette page.
      const paginationTenantId = "test-tenant-party-repo-pagination";
      await prisma.tenant.create({ data: { id: paginationTenantId, name: "Tenant pagination" } });
      const paginationRepository = new PrismaPartyRepository(paginationTenantId);
      const since = new Date(Date.now() - 1000);

      const [a, b, c] = await Promise.all([
        paginationRepository.create(createId(), {
          name: "Tiers pull page A",
          phone: "+221771234513",
          type: "CLIENT",
        }),
        paginationRepository.create(createId(), {
          name: "Tiers pull page B",
          phone: "+221771234514",
          type: "CLIENT",
        }),
        paginationRepository.create(createId(), {
          name: "Tiers pull page C",
          phone: "+221771234515",
          type: "CLIENT",
        }),
      ]);
      const queryStartedAt = new Date();

      const firstPage = await paginationRepository.findChangedSince(
        since,
        queryStartedAt,
        undefined,
        2,
      );
      expect(firstPage).toHaveLength(2);

      const last = firstPage[firstPage.length - 1];
      const secondPage = await paginationRepository.findChangedSince(
        since,
        queryStartedAt,
        { updatedAt: last.updatedAt, id: last.id },
        2,
      );
      expect(secondPage).toHaveLength(1);

      const allIds = [...firstPage, ...secondPage].map((row) => row.id);

      // Aucun chevauchement ni doublon entre les deux pages, et les trois
      // tiers créés dans ce test s'y retrouvent bien répartis, une fois chacun.
      expect(new Set(allIds).size).toBe(3);
      expect(allIds.sort()).toEqual([a.id, b.id, c.id].sort());

      await prisma.tenant.delete({ where: { id: paginationTenantId } });
    });
  });
});
