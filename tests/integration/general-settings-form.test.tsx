import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralSettingsForm } from "@/presentation/tenant/components/general-settings-form";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

const updateTenantSettingsActionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
  toastError: (...args: unknown[]) => toastErrorMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe("GeneralSettingsForm", () => {
  it("la devise est affichée en lecture seule", () => {
    render(<GeneralSettingsForm displayName={null} currency="FCFA" />);
    expect(screen.getByLabelText(tenantSettingsLabels.currencyField)).toBeDisabled();
  });

  it("soumet le nom affiché modifié", async () => {
    render(<GeneralSettingsForm displayName="Ancien nom" currency="FCFA" />);

    const input = screen.getByLabelText(tenantSettingsLabels.displayNameField);
    await userEvent.clear(input);
    await userEvent.type(input, "Boutique Awa");
    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(tenantSettingsLabels.savedMessage),
    );
    expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({ displayName: "Boutique Awa" });
  });

  it("notifie l'erreur renvoyée par l'action en cas d'échec", async () => {
    updateTenantSettingsActionMock.mockRejectedValue(new Error("Échec réseau"));
    render(<GeneralSettingsForm displayName="Nom" currency="FCFA" />);

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Échec réseau"));
  });
});
