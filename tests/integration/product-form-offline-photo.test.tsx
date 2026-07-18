import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductForm } from "@/presentation/product/components/product-form";
import { productLabels } from "@/presentation/shared/labels";
import type { Product } from "@/domain/product/product.entity";

/**
 * Câblage offline abandonné au profit d'un blocage explicite (cf.
 * CLAUDE.md) : le champ photo ne doit jamais transporter de sélection dans
 * une mutation mise en queue — il est désactivé et remplacé par un message
 * clair dès que `useNetworkStatus` signale hors ligne, réactivé au retour en
 * ligne. `createProductOfflineRepository`/`createProductCategoryOfflineRepository`
 * mockés (même choix que party-form.test.tsx/category-select.test.tsx) : ce
 * test vérifie le câblage React du formulaire, pas le moteur offline
 * lui-même.
 */
const createMock = vi.fn<(input: unknown) => Promise<Product>>();
const onlineMock = vi.fn();

vi.mock("@/presentation/product/offline-repository", () => ({
  createProductOfflineRepository: (
    _tenantId: string,
    _userId: string,
    onOfflineFallback?: () => void,
  ) => ({
    create: async (input: unknown) => {
      const result = await createMock(input);
      onOfflineFallback?.();
      return result;
    },
    update: vi.fn(),
  }),
}));

vi.mock("@/presentation/product-category/offline-repository", () => ({
  createProductCategoryOfflineRepository: () => ({
    create: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("@/presentation/shared/hooks/use-network-status", () => ({
  useNetworkStatus: (...args: unknown[]) => onlineMock(...args),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastQueuedOffline: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** BarcodeInput monte une ResponsivePanel (modale de scan) même fermée —
 * useMediaQuery y accède à window.matchMedia, absent de jsdom par défaut,
 * même stub que payment-modal.test.tsx. */
function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function mockNetworkStatus(online: boolean) {
  onlineMock.mockReturnValue({
    online,
    syncState: "idle",
    pendingCount: 0,
    failedCount: 0,
    triggerSync: vi.fn(),
  });
}

beforeEach(() => {
  createMock.mockReset();
  onlineMock.mockReset();
  stubMatchMedia(false);
});

function renderForm() {
  return render(
    <ProductForm
      mode="create"
      tenantId="tenant-1"
      userId="user-1"
      currency="FCFA"
      initialCategories={[]}
      submitLabel="Créer le produit"
    />,
  );
}

describe("ProductForm — désactivation du champ photo hors ligne", () => {
  it("affiche le sélecteur de photo actif quand l'app est en ligne", () => {
    mockNetworkStatus(true);
    renderForm();

    expect(
      screen.getByRole("button", { name: productLabels.photoSelectButtonLabel }),
    ).toBeInTheDocument();
    expect(screen.queryByText(productLabels.photoOfflineMessage)).not.toBeInTheDocument();
  });

  it("remplace le sélecteur de photo par un message clair quand l'app est hors ligne", () => {
    mockNetworkStatus(false);
    renderForm();

    expect(screen.getByText(productLabels.photoOfflineMessage)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: productLabels.photoSelectButtonLabel }),
    ).not.toBeInTheDocument();
  });

  it("réactive le sélecteur de photo au retour en ligne", () => {
    mockNetworkStatus(false);
    const { rerender } = renderForm();
    expect(screen.getByText(productLabels.photoOfflineMessage)).toBeInTheDocument();

    mockNetworkStatus(true);
    rerender(
      <ProductForm
        mode="create"
        tenantId="tenant-1"
        userId="user-1"
        currency="FCFA"
        initialCategories={[]}
        submitLabel="Créer le produit"
      />,
    );

    expect(
      screen.getByRole("button", { name: productLabels.photoSelectButtonLabel }),
    ).toBeInTheDocument();
    expect(screen.queryByText(productLabels.photoOfflineMessage)).not.toBeInTheDocument();
  });

  it("permet de créer un produit sans photo hors ligne, sans bloquer le reste du formulaire", async () => {
    mockNetworkStatus(false);
    createMock.mockResolvedValue({} as Product);
    renderForm();

    await userEvent.type(screen.getByLabelText(productLabels.nameField), "Sac de riz 50kg");
    const submitButton = screen.getByRole("button", { name: "Créer le produit" });
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);

    await vi.waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const input = createMock.mock.calls[0][0] as { photo?: unknown };
    expect(input.photo).toBeUndefined();
  });
});
