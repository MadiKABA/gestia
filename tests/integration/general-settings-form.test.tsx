import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralSettingsForm } from "@/presentation/tenant/components/general-settings-form";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";

const updateTenantSettingsActionMock = vi.fn();
const updateBusinessTypeActionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
  updateBusinessTypeAction: (...args: unknown[]) => updateBusinessTypeActionMock(...args),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
  toastError: (...args: unknown[]) => toastErrorMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
  updateBusinessTypeActionMock.mockReset().mockResolvedValue(undefined);
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe("GeneralSettingsForm", () => {
  it("affiche la devise actuelle du tenant dans le sélecteur", () => {
    render(
      <GeneralSettingsForm
        displayName={null}
        currency="GNF"
        businessType="ALIMENTATION_GENERALE"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("GNF");
  });

  it("soumet le nom affiché modifié avec la devise et le type de commerce inchangés", async () => {
    render(
      <GeneralSettingsForm displayName="Ancien nom" currency="FCFA" businessType="BOUCHERIE" />,
    );

    const input = screen.getByLabelText(tenantSettingsLabels.displayNameField);
    await userEvent.clear(input);
    await userEvent.type(input, "Boutique Awa");
    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(tenantSettingsLabels.savedMessage),
    );
    expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({
      displayName: "Boutique Awa",
      currency: "FCFA",
    });
    expect(updateBusinessTypeActionMock).toHaveBeenCalledWith({ businessType: "BOUCHERIE" });
  });

  it("ne permet de choisir la devise que parmi la liste fermée (FCFA, GNF)", async () => {
    render(
      <GeneralSettingsForm
        displayName={null}
        currency="FCFA"
        businessType="ALIMENTATION_GENERALE"
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Franc CFA (FCFA)", "Franc guinéen (GNF)"]);
  });

  it("soumet la devise nouvellement sélectionnée", async () => {
    render(
      <GeneralSettingsForm
        displayName={null}
        currency="FCFA"
        businessType="ALIMENTATION_GENERALE"
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Franc guinéen (GNF)" }));
    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() =>
      expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({
        displayName: null,
        currency: "GNF",
      }),
    );
  });

  it("soumet le type de commerce nouvellement sélectionné", async () => {
    render(
      <GeneralSettingsForm
        displayName={null}
        currency="FCFA"
        businessType="ALIMENTATION_GENERALE"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Boucherie" }));
    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() =>
      expect(updateBusinessTypeActionMock).toHaveBeenCalledWith({ businessType: "BOUCHERIE" }),
    );
  });

  it("notifie le message générique en cas d'échec (jamais le message brut de l'action)", async () => {
    updateTenantSettingsActionMock.mockRejectedValue(new Error("Échec réseau"));
    render(
      <GeneralSettingsForm
        displayName="Nom"
        currency="FCFA"
        businessType="ALIMENTATION_GENERALE"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(commonLabels.genericErrorToastMessage),
    );
  });
});
