import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDetail } from "@/presentation/product/components/product-detail";
import { productLabels, commonLabels } from "@/presentation/shared/labels";
import type { Product } from "@/domain/product/product.entity";

/**
 * Couvre la page détail produit — jusqu'ici inexistante (contrairement à
 * Party/Transaction) : le lien "Voir"/carte mobile de ProductsList pointait
 * directement vers `/produits/[id]/modifier`, faute d'autre route. Ce test
 * verrouille le rendu du nouveau composant, `createProductOfflineRepository`/
 * `seedProductCache` mockés — même choix que products-list.test.tsx.
 */
const getByIdMock = vi.fn<(id: string) => Promise<Product | null>>();
const deleteMock = vi.fn<(id: string) => Promise<void>>();

vi.mock("@/presentation/product/offline-repository", () => ({
  createProductOfflineRepository: () => ({ getById: getByIdMock, delete: deleteMock }),
  seedProductCache: vi.fn().mockResolvedValue(undefined),
}));

// ProductDetail se relit désormais à chaque syncVersion (voir
// products-list.test.tsx pour le même choix) — l'implémentation réelle
// touche IndexedDB, absent de jsdom ici.
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

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
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

beforeEach(() => {
  getByIdMock.mockReset().mockResolvedValue(null);
  deleteMock.mockReset().mockResolvedValue(undefined);
  pushMock.mockReset();
});

describe("ProductDetail", () => {
  it("affiche les informations du produit (nom, type, prix, unité, code-barres)", () => {
    render(
      <ProductDetail
        product={makeProduct({ barcode: "1234567890123", purchasePrice: 12000 })}
        categoryName="Épicerie"
        tenantId="tenant-1"
        userId="user-1"
        canManage
        currency="FCFA"
      />,
    );

    expect(screen.getByText("Sac de riz 50kg")).toBeInTheDocument();
    expect(screen.getByText(/Produit · Épicerie/)).toBeInTheDocument();
    expect(screen.getByText("1234567890123")).toBeInTheDocument();
  });

  it("affiche les actions Modifier/Supprimer pour un patron (canManage)", () => {
    render(
      <ProductDetail
        product={makeProduct()}
        categoryName={null}
        tenantId="tenant-1"
        userId="user-1"
        canManage
        currency="FCFA"
      />,
    );

    expect(screen.getByRole("button", { name: productLabels.editButtonLabel })).toHaveAttribute(
      "href",
      "/produits/product-1/modifier",
    );
    expect(screen.getByRole("button", { name: commonLabels.delete })).toBeInTheDocument();
  });

  it("masque les actions Modifier/Supprimer pour un vendeur (canManage = false)", () => {
    render(
      <ProductDetail
        product={makeProduct()}
        categoryName={null}
        tenantId="tenant-1"
        userId="user-1"
        canManage={false}
        currency="FCFA"
      />,
    );

    expect(
      screen.queryByRole("button", { name: productLabels.editButtonLabel }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: commonLabels.delete })).not.toBeInTheDocument();
  });

  it("supprime le produit et redirige vers la liste après confirmation", async () => {
    const user = userEvent.setup();
    render(
      <ProductDetail
        product={makeProduct()}
        categoryName={null}
        tenantId="tenant-1"
        userId="user-1"
        canManage
        currency="FCFA"
      />,
    );

    await user.click(screen.getByRole("button", { name: commonLabels.delete }));
    await user.click(screen.getByRole("button", { name: commonLabels.delete }));

    expect(deleteMock).toHaveBeenCalledWith("product-1");
    expect(pushMock).toHaveBeenCalledWith("/produits");
  });
});
