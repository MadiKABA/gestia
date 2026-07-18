import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsList } from "@/presentation/product/components/products-list";
import { productLabels } from "@/presentation/shared/labels";
import type { Product } from "@/domain/product/product.entity";

/**
 * `createProductOfflineRepository`/`seedProductCache` mockés — même choix
 * que transactions-list.test.tsx : ce test vérifie le rendu de ProductsList
 * (miniature/placeholder, pagination "Voir plus"), pas le moteur offline.
 * `useNetworkStatus` mocké de la même façon que
 * product-form-offline-photo.test.tsx : ProductsList l'appelle désormais
 * (syncVersion, voir network-status-store.ts) et l'implémentation réelle
 * touche IndexedDB, absent de jsdom ici.
 */
const listMock = vi.fn<() => Promise<Product[]>>();

vi.mock("@/presentation/product/offline-repository", () => ({
  createProductOfflineRepository: () => ({ list: listMock, delete: vi.fn() }),
  seedProductCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/presentation/shared/hooks/use-network-status", () => ({
  useNetworkStatus: () => ({
    online: true,
    syncState: "idle",
    pendingCount: 0,
    failedCount: 0,
    syncVersion: 0,
    triggerSync: vi.fn(),
  }),
}));

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "product-1",
    tenantId: "tenant-1",
    name: "Sac de riz 50kg",
    description: null,
    type: "PRODUIT",
    purchasePrice: null,
    sellingPrice: 15000,
    unit: "SAC",
    trackStock: false,
    stockQuantity: null,
    barcode: null,
    photoUrl: null,
    categoryId: null,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function renderList(products: Product[]) {
  render(
    <ProductsList
      initialProducts={products}
      tenantId="tenant-1"
      userId="user-1"
      canManage
      categories={[]}
      currency="FCFA"
    />,
  );
}

beforeEach(() => {
  listMock.mockReset();
});

describe("ProductsList — image produit desktop et mobile", () => {
  it("affiche la photo du produit et un placeholder pour un produit sans photo, dans la carte mobile et la ligne de tableau desktop", async () => {
    const withPhoto = makeProduct({
      id: "product-photo",
      name: "Sac de riz 50kg",
      photoUrl: "https://res.cloudinary.com/demo/image/upload/rizphotouniquesac.jpg",
    });
    const withoutPhoto = makeProduct({
      id: "product-sans-photo",
      name: "Huile 1L",
      photoUrl: null,
    });
    listMock.mockResolvedValue([withPhoto, withoutPhoto]);
    renderList([withPhoto, withoutPhoto]);

    // Les deux vues (mobile <ul>, desktop <table>) sont toutes deux présentes
    // dans le DOM en test (jsdom n'évalue pas les media queries Tailwind qui
    // les cachent visuellement) — chaque produit apparaît donc deux fois.
    await screen.findAllByText(withPhoto.name);

    const photoImages = Array.from(document.querySelectorAll("img")).filter((img) =>
      img.getAttribute("src")?.includes("rizphotouniquesac"),
    );
    expect(photoImages).toHaveLength(2); // une en carte mobile, une en ligne desktop

    // Placeholder du produit sans photo : icône dans un carré neutre
    // (ProductThumbnail), présent deux fois pour la même raison.
    const placeholders = document.querySelectorAll("div.bg-muted.rounded-lg.size-10");
    expect(placeholders).toHaveLength(2);
  });
});

describe("ProductsList — navigation détail vs modification", () => {
  it("pointe la carte mobile et le bouton « Voir » desktop vers la page détail, jamais directement vers la modification", async () => {
    const product = makeProduct({ id: "product-42" });
    listMock.mockResolvedValue([product]);
    renderList([product]);

    // Les deux vues (mobile <ul>, desktop <table>) sont toutes deux présentes
    // dans le DOM en test (voir le test de miniature ci-dessus) — le nom
    // apparaît donc deux fois, seule la première (carte mobile) est un lien.
    const occurrences = await screen.findAllByText(product.name);

    // Carte mobile : le lien enveloppant nom/catégorie mène au détail.
    const mobileLink = occurrences[0].closest("a");
    expect(mobileLink).toHaveAttribute("href", "/produits/product-42");

    // Desktop : bouton "Voir" (icône œil) mène au détail, distinct du
    // bouton "Modifier" (icône crayon) qui reste sur /modifier.
    expect(screen.getByRole("button", { name: productLabels.viewActionLabel })).toHaveAttribute(
      "href",
      "/produits/product-42",
    );
    expect(screen.getByRole("button", { name: productLabels.editButtonLabel })).toHaveAttribute(
      "href",
      "/produits/product-42/modifier",
    );
  });
});

describe("ProductsList — pagination", () => {
  it("n'affiche que les 20 premiers produits puis révèle le reste au clic sur Voir plus", async () => {
    const products = Array.from({ length: 25 }, (_, i) =>
      makeProduct({ id: `product-${i}`, name: `Produit ${String(i).padStart(2, "0")}` }),
    );
    listMock.mockResolvedValue(products);
    renderList(products);

    await screen.findByText(productLabels.showMoreLabel);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(21); // en-tête + 20 lignes

    await userEvent.click(screen.getByText(productLabels.showMoreLabel));

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26); // en-tête + 25 lignes
    expect(screen.queryByText(productLabels.showMoreLabel)).not.toBeInTheDocument();
  });
});
