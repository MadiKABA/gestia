import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

/** En-tête PNG réel (magic bytes) — validateProductPhotoFile vérifie le
 * contenu réel du fichier, pas seulement le mimeType déclaré (voir
 * domain/shared/image-file.ts), une chaîne arbitraire est donc rejetée. */
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");

const uploadMock =
  vi.fn<
    (
      file: { buffer: Buffer; mimeType: string },
      tenantId: string,
      productId: string,
    ) => Promise<{ url: string }>
  >();

/**
 * L'upload Cloudinary réel n'est jamais exercé en test (même convention que
 * le reste du projet — voir logo-upload-form.test.tsx, aucun test n'appelle
 * le vrai CloudinaryLogoUploader) : seul le mutation-handler (le point exact
 * où la photo transite de base64 vers une URL) est vérifié ici, avec un
 * uploader simulé.
 */
vi.mock("@/infrastructure/external/cloudinary-client", () => ({
  CloudinaryProductPhotoUploader: class {
    upload = uploadMock;
  },
}));

const { prisma } = await import("@/infrastructure/prisma/client");
const { productMutationHandler } =
  await import("@/infrastructure/product/product-mutation-handler");
const { ValidationError } = await import("@/domain/shared/errors");

describe("productMutationHandler", () => {
  const tenantId = "test-tenant-product-mutation-handler";
  const context = { tenantId, userId: "", role: "PATRON" as const };

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
    context.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("create sans photo : n'appelle jamais l'uploader, photoUrl reste null", async () => {
    uploadMock.mockClear();
    const id = createId();

    const result = await productMutationHandler.create(context, id, {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      sellingPrice: 15000,
    });

    expect(uploadMock).not.toHaveBeenCalled();
    const row = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(row.photoUrl).toBeNull();
    expect(result.updatedAt).toBe(row.updatedAt.toISOString());
  });

  it("create avec photo : upload différé résolu par le mutation-handler, photoUrl posée", async () => {
    uploadMock.mockClear();
    uploadMock.mockResolvedValue({ url: "https://res.cloudinary.com/demo/products/fake.jpg" });
    const id = createId();
    const base64 = PNG_BASE64;

    await productMutationHandler.create(context, id, {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      sellingPrice: 15000,
      photo: { mimeType: "image/png", base64 },
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [, calledTenantId, calledProductId] = uploadMock.mock.calls[0]!;
    expect(calledTenantId).toBe(tenantId);
    expect(calledProductId).toBe(id);

    const row = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(row.photoUrl).toBe("https://res.cloudinary.com/demo/products/fake.jpg");
  });

  it("update avec photo = null : supprime la photo existante sans appeler l'uploader", async () => {
    uploadMock.mockClear();
    uploadMock.mockResolvedValue({ url: "https://res.cloudinary.com/demo/products/fake2.jpg" });
    const id = createId();
    await productMutationHandler.create(context, id, {
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      sellingPrice: 15000,
      photo: { mimeType: "image/png", base64: PNG_BASE64 },
    });
    uploadMock.mockClear();

    const before = await prisma.product.findUniqueOrThrow({ where: { id } });
    await productMutationHandler.update(
      context,
      id,
      { name: "Sac de riz 50kg", type: "PRODUIT", sellingPrice: 15000, photo: null },
      before.updatedAt.toISOString(),
    );

    expect(uploadMock).not.toHaveBeenCalled();
    const row = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(row.photoUrl).toBeNull();
  });

  it("create rejeté par un code-barres déjà utilisé (unicité par tenant)", async () => {
    const barcode = `test-barcode-${createId()}`;
    await productMutationHandler.create(context, createId(), {
      name: "Produit A",
      type: "PRODUIT",
      sellingPrice: 1000,
      barcode,
    });

    await expect(
      productMutationHandler.create(context, createId(), {
        name: "Produit B",
        type: "PRODUIT",
        sellingPrice: 2000,
        barcode,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("update rejeté par un code-barres déjà utilisé par un autre produit", async () => {
    const barcode = `test-barcode-${createId()}`;
    await productMutationHandler.create(context, createId(), {
      name: "Produit A",
      type: "PRODUIT",
      sellingPrice: 1000,
      barcode,
    });
    const otherId = createId();
    await productMutationHandler.create(context, otherId, {
      name: "Produit B",
      type: "PRODUIT",
      sellingPrice: 2000,
    });
    const other = await prisma.product.findUniqueOrThrow({ where: { id: otherId } });

    await expect(
      productMutationHandler.update(
        context,
        otherId,
        { name: "Produit B", type: "PRODUIT", sellingPrice: 2000, barcode },
        other.updatedAt.toISOString(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("create rejoué avec le même clientGeneratedId (retry-safe) renvoie un succès sans dupliquer", async () => {
    const id = createId();
    const payload = { name: "Produit rejoué", type: "PRODUIT" as const, sellingPrice: 1000 };

    const first = await productMutationHandler.create(context, id, payload);
    const second = await productMutationHandler.create(context, id, payload);

    expect(second.updatedAt).toBe(first.updatedAt);
    const count = await prisma.product.count({ where: { tenantId, name: "Produit rejoué" } });
    expect(count).toBe(1);
  });
});
