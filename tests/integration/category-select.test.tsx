import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategorySelect } from "@/presentation/product/components/category-select";
import { productLabels } from "@/presentation/shared/labels";

const createMock = vi.fn();
const listMock = vi.fn();

vi.mock("@/presentation/product-category/offline-repository", () => ({
  createProductCategoryOfflineRepository: () => ({ create: createMock, list: listMock }),
}));

beforeEach(() => {
  createMock.mockReset();
  listMock.mockReset().mockResolvedValue([]);
});

describe("CategorySelect", () => {
  it("crée une catégorie à la volée sans quitter le formulaire et la sélectionne aussitôt", async () => {
    createMock.mockResolvedValue({
      id: "new-category-id",
      tenantId: "tenant-1",
      name: "Boissons",
      createdAt: new Date(),
    });
    const onChange = vi.fn();

    render(
      <CategorySelect
        tenantId="tenant-1"
        userId="user-1"
        value={null}
        onChange={onChange}
        initialCategories={[]}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: productLabels.categoryCreateNewLabel }),
    );

    const nameInput = screen.getByPlaceholderText(productLabels.categoryNewNamePlaceholder);
    await userEvent.type(nameInput, "Boissons");
    await userEvent.click(
      screen.getByRole("button", { name: productLabels.categoryAddButtonLabel }),
    );

    await vi.waitFor(() => expect(createMock).toHaveBeenCalledWith({ name: "Boissons" }));
    expect(onChange).toHaveBeenCalledWith("new-category-id");
  });

  it("affiche une catégorie existante fournie en props sans appel réseau supplémentaire", () => {
    render(
      <CategorySelect
        tenantId="tenant-1"
        userId="user-1"
        value="cat-1"
        onChange={vi.fn()}
        initialCategories={[{ id: "cat-1", name: "Alimentation" }]}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Alimentation");
  });

  it("affiche le message d'erreur du repository si la création échoue (ex: nom déjà utilisé)", async () => {
    createMock.mockRejectedValue(new Error("Cette catégorie existe déjà"));

    render(
      <CategorySelect
        tenantId="tenant-1"
        userId="user-1"
        value={null}
        onChange={vi.fn()}
        initialCategories={[]}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: productLabels.categoryCreateNewLabel }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(productLabels.categoryNewNamePlaceholder),
      "Boissons",
    );
    await userEvent.click(
      screen.getByRole("button", { name: productLabels.categoryAddButtonLabel }),
    );

    expect(await screen.findByText("Cette catégorie existe déjà")).toBeInTheDocument();
  });
});
