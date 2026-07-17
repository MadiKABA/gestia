import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ProductPhotoInput } from "@/presentation/product/components/product-photo-input";

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

/** fireEvent.change (pas userEvent.upload) : même choix que
 * logo-upload-form.test.tsx, voir son commentaire. */
function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeAll(() => {
  // jsdom n'implémente pas createObjectURL — l'aperçu local n'est pas ce que
  // ce test vérifie (voir CategorySelect/ProductForm pour l'UI), seulement
  // l'absence d'appel réseau à la sélection.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("ProductPhotoInput", () => {
  it("ne déclenche aucun appel réseau à la sélection d'un fichier valide", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onChange = vi.fn();
    const { container } = render(<ProductPhotoInput value={undefined} onChange={onChange} />);
    const file = new File(["contenu-image"], "photo.png", { type: "image/png" });

    selectFile(getFileInput(container), file);

    // La lecture du fichier (FileReader, en mémoire) est asynchrone — laisse
    // le temps à onChange d'être appelé avant de vérifier l'absence de fetch.
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/png", base64: expect.any(String) }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejette un format non supporté sans appeler onChange", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <ProductPhotoInput value={undefined} onChange={onChange} />,
    );
    const file = new File(["contenu"], "photo.gif", { type: "image/gif" });

    selectFile(getFileInput(container), file);

    expect(onChange).not.toHaveBeenCalled();
    expect(
      getByText("Format d'image non supporté (PNG, JPEG ou WEBP uniquement)"),
    ).toBeInTheDocument();
  });

  it("rejette un fichier trop volumineux sans appeler onChange", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <ProductPhotoInput value={undefined} onChange={onChange} />,
    );
    const oversized = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "photo.png", {
      type: "image/png",
    });

    selectFile(getFileInput(container), oversized);

    expect(onChange).not.toHaveBeenCalled();
    expect(getByText("La photo ne doit pas dépasser 3 Mo")).toBeInTheDocument();
  });
});
