import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaProductCategoryRepository } from "@/infrastructure/product-category/product-category.repository";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { createProductCategory } from "@/application/product-category/create-product-category.use-case";
import { updateProductCategory } from "@/application/product-category/update-product-category.use-case";
import { deleteProductCategory } from "@/application/product-category/delete-product-category.use-case";
import { createProduct } from "@/application/product/create-product.use-case";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Tests d'intégration (couche application, contre un Postgres réel) : les
 * use cases de modification/suppression de catégorie — permissions (réservé
 * au patron), AuditLog, et surtout la restriction de suppression bloquée
 * tant qu'un produit/service actif y est associé (cf. CLAUDE.md).
 */
describe("use cases product-category", () => {
  const tenantId = "test-tenant-product-category-usecases";
  const categoryRepository = new PrismaProductCategoryRepository(tenantId);
  const productRepository = new PrismaProductRepository(tenantId);
  const auditLogger = new PrismaAuditLogger();
  const hasActiveProducts = (categoryId: string) =>
    productRepository.hasActiveProductsInCategory(categoryId);

  const patronContext: TenantContext = { tenantId, userId: "", role: "PATRON" };
  const vendeurContext: TenantContext = { tenantId, userId: "", role: "VENDEUR" };

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999912",
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

  it("updateProductCategory refuse un VENDEUR", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Épicerie" },
    );

    await expect(
      updateProductCategory(
        vendeurContext,
        { repository: categoryRepository, auditLogger },
        category.id,
        { name: "Épicerie renommée" },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updateProductCategory (PATRON) renomme la catégorie et écrit une entrée AuditLog", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Boissons" },
    );

    const updated = await updateProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      category.id,
      { name: "Boissons fraîches" },
    );
    expect(updated.name).toBe("Boissons fraîches");

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "ProductCategory",
        entityId: category.id,
        action: "product_category.updated",
      },
    });
    expect(log).not.toBeNull();
  });

  it("deleteProductCategory refuse un VENDEUR", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Hygiène" },
    );

    await expect(
      deleteProductCategory(
        vendeurContext,
        { repository: categoryRepository, auditLogger, hasActiveProducts },
        category.id,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deleteProductCategory bloque la suppression si un produit actif est associé", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Épicerie salée" },
    );
    await createProduct(
      patronContext,
      { repository: productRepository, categoryRepository, auditLogger },
      createId(),
      {
        name: "Sac de riz 50kg",
        type: "PRODUIT",
        sellingPrice: 15000,
        categoryId: category.id,
      },
    );

    await expect(
      deleteProductCategory(
        patronContext,
        { repository: categoryRepository, auditLogger, hasActiveProducts },
        category.id,
      ),
    ).rejects.toThrow(
      "Cette catégorie contient encore des produits, retire-les d'abord ou change leur catégorie",
    );

    await expect(
      deleteProductCategory(
        patronContext,
        { repository: categoryRepository, auditLogger, hasActiveProducts },
        category.id,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("deleteProductCategory (PATRON) supprime une catégorie vide et écrit une entrée AuditLog", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Catégorie vide" },
    );

    await deleteProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger, hasActiveProducts },
      category.id,
    );

    const found = await prisma.productCategory.findUnique({ where: { id: category.id } });
    expect(found?.deletedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entity: "ProductCategory",
        entityId: category.id,
        action: "product_category.deleted",
      },
    });
    expect(log).not.toBeNull();

    await expect(categoryRepository.findById(category.id)).resolves.toBeNull();
  });

  it("deleteProductCategory redevient possible une fois le produit retiré de la catégorie", async () => {
    const category = await createProductCategory(
      patronContext,
      { repository: categoryRepository, auditLogger },
      createId(),
      { name: "Épicerie sucrée" },
    );
    const product = await createProduct(
      patronContext,
      { repository: productRepository, categoryRepository, auditLogger },
      createId(),
      { name: "Sucre 1kg", type: "PRODUIT", sellingPrice: 500, categoryId: category.id },
    );

    await expect(
      deleteProductCategory(
        patronContext,
        { repository: categoryRepository, auditLogger, hasActiveProducts },
        category.id,
      ),
    ).rejects.toThrow(ValidationError);

    await productRepository.update(product.id, {
      name: product.name,
      type: product.type,
      sellingPrice: product.sellingPrice,
      categoryId: null,
    });

    await expect(
      deleteProductCategory(
        patronContext,
        { repository: categoryRepository, auditLogger, hasActiveProducts },
        category.id,
      ),
    ).resolves.toMatchObject({ id: category.id });
  });
});
