import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParametresPanel } from "@/presentation/tenant/components/parametres-panel";
import { tenantSettingsLabels, commonLabels } from "@/presentation/shared/labels";
import type { TenantSettingsFull } from "@/application/tenant/tenant-settings.repository";

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: vi.fn().mockResolvedValue(undefined),
  uploadTenantLogoAction: vi.fn().mockResolvedValue({ logoUrl: null }),
}));

const SETTINGS: TenantSettingsFull = {
  displayName: "Boutique Awa",
  currency: "FCFA",
  reminderDays: 7,
  whatsappTemplate: null,
  whatsappReceiptPartialTemplate: null,
  whatsappReceiptFinalTemplate: null,
  brandColor: "#1B7A5A",
  logoUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ParametresPanel", () => {
  it("affiche l'onglet Général par défaut et masque les autres sections", () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);

    expect(screen.getByLabelText(tenantSettingsLabels.displayNameField)).toBeInTheDocument();
    expect(screen.queryByLabelText(tenantSettingsLabels.reminderDaysField)).not.toBeInTheDocument();
    expect(screen.queryByText(tenantSettingsLabels.brandColorField)).not.toBeInTheDocument();
  });

  it("démonte la section précédente en changeant d'onglet", async () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);

    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.relanceSectionTitle }),
    );

    expect(screen.getByLabelText(tenantSettingsLabels.reminderDaysField)).toBeInTheDocument();
    expect(screen.queryByLabelText(tenantSettingsLabels.displayNameField)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.appearanceSectionTitle }),
    );

    expect(screen.getByText(tenantSettingsLabels.brandColorField)).toBeInTheDocument();
    expect(screen.queryByLabelText(tenantSettingsLabels.reminderDaysField)).not.toBeInTheDocument();
  });

  it("la grille Général passe en 2 colonnes à partir de lg", () => {
    const { container } = render(<ParametresPanel initialSettings={SETTINGS} />);

    const grid = container.querySelector("form > div.space-y-4");
    expect(grid).toHaveClass("lg:grid-cols-2");
  });

  it("l'onglet Relances affiche à la fois la relance et les gabarits de reçu", async () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);
    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.relanceSectionTitle }),
    );

    expect(
      screen.getByRole("heading", { name: tenantSettingsLabels.relanceSectionTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: tenantSettingsLabels.whatsappReceiptsSectionTitle }),
    ).toBeInTheDocument();
  });

  it("la grille Relances utilise une colonne étroite et une large à partir de lg", async () => {
    const { container } = render(<ParametresPanel initialSettings={SETTINGS} />);
    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.relanceSectionTitle }),
    );

    const grid = container.querySelector("form > div.space-y-4");
    expect(grid).toHaveClass("lg:grid-cols-[220px_1fr]");
  });

  it("la grille Apparence passe en 2 colonnes à partir de lg", async () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);
    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.appearanceSectionTitle }),
    );

    const heading = screen.getByRole("heading", {
      name: tenantSettingsLabels.appearanceSectionTitle,
    });
    const grid = heading.nextElementSibling;
    expect(grid).toHaveClass("lg:grid-cols-2");
  });

  it("le bouton Annuler n'est visible qu'à partir de lg, Enregistrer reste pleine largeur en mobile", () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);

    const cancelButton = screen.getByRole("button", { name: commonLabels.cancel });
    expect(cancelButton).toHaveClass("hidden", "lg:inline-flex");

    const saveButton = screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel });
    expect(saveButton).toHaveClass("w-full", "lg:w-auto");
  });

  it("l'onglet Apparence n'a pas de bouton Enregistrer (sauvegarde instantanée)", async () => {
    render(<ParametresPanel initialSettings={SETTINGS} />);
    await userEvent.click(
      screen.getByRole("tab", { name: tenantSettingsLabels.appearanceSectionTitle }),
    );

    expect(
      screen.queryByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    ).not.toBeInTheDocument();
  });
});
