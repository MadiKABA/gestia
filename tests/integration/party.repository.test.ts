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
});
