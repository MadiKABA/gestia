import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createProduct } from "@/application/product/create-product.use-case";
import { updateProduct } from "@/application/product/update-product.use-case";
import { deleteProduct } from "@/application/product/delete-product.use-case";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases critiques du module produit — permissions (réservé au patron,
 * le vendeur ne peut que consulter/sélectionner, cf. CLAUDE.md Rôles),
 * AuditLog, soft delete.
 */
describe("use cases product", () => {
  const tenantId = "test-tenant-product-usecases";
  const repository = new PrismaProductRepository(tenantId);
  const auditLogger = new PrismaAuditLogger();

  const patronContext: TenantContext = { tenantId, userId: "", role: "PATRON" };
  const vendeurContext: TenantContext = { tenantId, userId: "", role: "VENDEUR" };

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999911",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    patronContext.userId = patron.id;
    vendeurContext.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("createProduct écrit une entrée AuditLog", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
      unit: "SAC",
    });

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Product", entityId: product.id, action: "product.created" },
    });
    expect(log).not.toBeNull();
  });

  it("createProduct refuse un VENDEUR", async () => {
    await expect(
      createProduct(vendeurContext, { repository, auditLogger }, createId(), {
        name: "Sac de riz 50kg",
        type: "PRODUIT",
        price: 15000,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updateProduct refuse un VENDEUR", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
    });

    await expect(
      updateProduct(vendeurContext, { repository, auditLogger }, product.id, {
        name: "Sac de riz 50kg (modifié)",
        type: "PRODUIT",
        price: 16000,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updateProduct (PATRON) modifie le produit et écrit une entrée AuditLog", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
    });

    const updated = await updateProduct(patronContext, { repository, auditLogger }, product.id, {
      name: "Sac de riz 50kg (promo)",
      type: "PRODUIT",
      price: 13000,
    });
    expect(updated.price).toBe(13000);

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Product", entityId: product.id, action: "product.updated" },
    });
    expect(log).not.toBeNull();
  });

  it("deleteProduct refuse un VENDEUR", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
    });

    await expect(
      deleteProduct(vendeurContext, { repository, auditLogger }, product.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deleteProduct (PATRON) fait un soft delete et écrit une entrée AuditLog", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
    });

    await deleteProduct(patronContext, { repository, auditLogger }, product.id);

    const found = await prisma.product.findUnique({ where: { id: product.id } });
    expect(found?.deletedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Product", entityId: product.id, action: "product.deleted" },
    });
    expect(log).not.toBeNull();

    await expect(repository.findById(product.id)).resolves.toBeNull();
  });

  it("deleteProduct rejette un produit déjà supprimé", async () => {
    const product = await createProduct(patronContext, { repository, auditLogger }, createId(), {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      price: 15000,
    });
    await deleteProduct(patronContext, { repository, auditLogger }, product.id);

    await expect(
      deleteProduct(patronContext, { repository, auditLogger }, product.id),
    ).rejects.toThrow(NotFoundError);
  });
});
