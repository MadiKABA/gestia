import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/** En-tête PNG réel (magic bytes) — validateProductPhotoFile vérifie le
 * contenu réel du fichier, pas seulement le mimeType déclaré. */
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");

const uploadMock =
  vi.fn<
    (
      file: { buffer: Buffer; mimeType: string },
      tenantId: string,
      productId: string,
    ) => Promise<{ url: string }>
  >();

/** Même convention que product-mutation-handler.test.ts : jamais d'appel
 * Cloudinary réel en test, seul le comportement du mutation-handler compte
 * ici (upload différé déclenché par la synchronisation, pas par l'écriture
 * locale). */
vi.mock("@/infrastructure/external/cloudinary-client", () => ({
  CloudinaryProductPhotoUploader: class {
    upload = uploadMock;
  },
}));

const { prisma } = await import("@/infrastructure/prisma/client");
const { PrismaAuditLogger } = await import("@/infrastructure/audit-log/audit-log.repository");
const { registerMutationHandler } = await import("@/application/offline/mutation-handler-registry");
const { registerMutationSchema } = await import("@/application/offline/mutation-schema-registry");
const { productMutationHandler } =
  await import("@/infrastructure/product/product-mutation-handler");
const { productSyncPayloadSchema } =
  await import("@/infrastructure/product/product-mutation.schema");
const { syncMutation } = await import("@/application/offline/sync-mutation.use-case");
const { syncQueue } = await import("@/infrastructure/offline/sync-engine");
const { ProductOfflineRepository } =
  await import("@/infrastructure/product/product-offline.repository");

/**
 * Test d'intégration bout-en-bout du module Product, même schéma que
 * party-offline-sync.test.ts : ProductOfflineRepository (cache local + queue)
 * -> syncQueue -> syncMutation -> productMutationHandler -> use cases
 * create/updateProduct -> Postgres réel.
 */
describe("Product offline-first : bout en bout", () => {
  const tenantId = "test-tenant-product-offline";
  const auditLogger = new PrismaAuditLogger();
  const context = { tenantId, userId: "", role: "PATRON" as const };

  const syncTransport = async (mutation: QueuedMutation) => ({
    ok: true as const,
    data: await syncMutation(context, { auditLogger }, mutation),
  });

  beforeAll(async () => {
    registerMutationHandler("product", productMutationHandler);
    registerMutationSchema("product", productSyncPayloadSchema);

    await prisma.tenant.create({ data: { id: tenantId, name: "Tenant de test offline produit" } });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999913",
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
    const repository = new ProductOfflineRepository({ tenantId, userId: context.userId });

    const created = await repository.create({
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      sellingPrice: 15000,
      unit: "SAC",
    });

    // Visible immédiatement dans le cache local, avant toute synchronisation.
    const localList = await repository.list({});
    expect(localList.map((p) => p.id)).toContain(created.id);
    expect(await prisma.product.findUnique({ where: { id: created.id } })).toBeNull();

    const result = await syncQueue({ tenantId, syncTransport });
    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });

    const inDb = await prisma.product.findUnique({ where: { id: created.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.name).toBe("Sac de riz 50kg");
    expect(inDb?.id).toBe(created.id);

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Product", entityId: created.id, action: "product.created" },
    });
    expect(log).not.toBeNull();
  });

  it("créer hors ligne avec une photo : upload Cloudinary différé au moment de la synchronisation, jamais à l'écriture locale", async () => {
    uploadMock.mockClear();
    uploadMock.mockResolvedValue({ url: "https://res.cloudinary.com/demo/products/offline.jpg" });

    const repository = new ProductOfflineRepository({ tenantId, userId: context.userId });
    const base64 = PNG_BASE64;

    const created = await repository.create({
      name: "Sac de riz 25kg",
      type: "PRODUIT",
      sellingPrice: 8000,
      photo: { mimeType: "image/png", base64 },
    });

    // Écriture locale : jamais d'appel réseau/Cloudinary, photoUrl inconnue
    // localement tant que la synchronisation n'a pas eu lieu.
    expect(uploadMock).not.toHaveBeenCalled();
    expect(created.photoUrl).toBeNull();

    await syncQueue({ tenantId, syncTransport });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const inDb = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.photoUrl).toBe("https://res.cloudinary.com/demo/products/offline.jpg");
  });

  it("modifier hors ligne : reste en attente jusqu'à la synchronisation, avec AuditLog", async () => {
    const repository = new ProductOfflineRepository({ tenantId, userId: context.userId });
    const created = await repository.create({
      name: "Service de test",
      type: "SERVICE",
      sellingPrice: 3000,
    });
    await syncQueue({ tenantId, syncTransport });

    await repository.update(created.id, {
      name: "Service de test (modifié)",
      type: "SERVICE",
      sellingPrice: 3500,
    });

    // Toujours l'ancien prix côté serveur avant synchronisation.
    expect(
      (
        await prisma.product.findUniqueOrThrow({ where: { id: created.id } })
      ).sellingPrice.toNumber(),
    ).toBe(3000);

    await syncQueue({ tenantId, syncTransport });

    const inDb = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(inDb.sellingPrice.toNumber()).toBe(3500);

    const log = await prisma.auditLog.findFirst({
      where: { tenantId, entity: "Product", entityId: created.id, action: "product.updated" },
    });
    expect(log).not.toBeNull();
  });
});
