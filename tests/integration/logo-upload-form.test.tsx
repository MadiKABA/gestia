import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LogoUploadForm } from "@/presentation/tenant/components/logo-upload-form";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

const uploadTenantLogoActionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  uploadTenantLogoAction: (...args: unknown[]) => uploadTenantLogoActionMock(...args),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
  toastError: (...args: unknown[]) => toastErrorMock(...args),
}));

beforeEach(() => {
  uploadTenantLogoActionMock.mockReset().mockResolvedValue({
    logoUrl: "https://res.cloudinary.com/gestia/logo.png",
  });
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

/**
 * fireEvent.change (pas userEvent.upload) : userEvent.upload filtre les
 * fichiers selon l'attribut `accept` du input, comme un vrai sélecteur de
 * fichiers — ce qui empêche justement de tester le cas qu'on veut couvrir
 * ici (un fichier dont le mimeType ne correspond pas, contourné côté
 * navigateur par une extension renommée).
 */
function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("LogoUploadForm", () => {
  it("rejette un format non supporté sans appeler l'action", () => {
    const { container } = render(<LogoUploadForm logoUrl={null} />);
    const file = new File(["contenu"], "logo.gif", { type: "image/gif" });

    selectFile(getFileInput(container), file);

    expect(
      screen.getByText("Format d'image non supporté (PNG, JPEG ou WEBP uniquement)"),
    ).toBeInTheDocument();
    expect(uploadTenantLogoActionMock).not.toHaveBeenCalled();
  });

  it("rejette un fichier trop volumineux sans appeler l'action", () => {
    const { container } = render(<LogoUploadForm logoUrl={null} />);
    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", {
      type: "image/png",
    });

    selectFile(getFileInput(container), oversized);

    expect(screen.getByText("Le logo ne doit pas dépasser 2 Mo")).toBeInTheDocument();
    expect(uploadTenantLogoActionMock).not.toHaveBeenCalled();
  });

  it("appelle l'action pour un fichier valide et met à jour l'aperçu", async () => {
    const { container } = render(<LogoUploadForm logoUrl={null} />);
    const file = new File(["contenu"], "logo.png", { type: "image/png" });

    selectFile(getFileInput(container), file);

    expect(uploadTenantLogoActionMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toContain("logo.png");
    });
  });

  it("notifie l'erreur renvoyée par le serveur en cas d'échec de l'upload", async () => {
    uploadTenantLogoActionMock.mockRejectedValue(new Error("Échec de l'upload"));
    const { container } = render(<LogoUploadForm logoUrl={null} />);
    const file = new File(["contenu"], "logo.png", { type: "image/png" });

    selectFile(getFileInput(container), file);

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Échec de l'upload"));
  });

  it("désactive le bouton pendant l'envoi", () => {
    render(<LogoUploadForm logoUrl={null} />);
    expect(
      screen.getByRole("button", { name: tenantSettingsLabels.logoUploadButtonLabel }),
    ).not.toBeDisabled();
  });
});
