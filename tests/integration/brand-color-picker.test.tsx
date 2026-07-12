import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandColorPicker } from "@/presentation/tenant/components/brand-color-picker";
import { BRAND_PRESETS } from "@/config/brand-presets";

const updateTenantSettingsActionMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
});

describe("BrandColorPicker", () => {
  it("marque la couleur actuelle comme sélectionnée", () => {
    render(<BrandColorPicker brandColor={BRAND_PRESETS[0].value} />);
    expect(screen.getByRole("button", { name: BRAND_PRESETS[0].label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: BRAND_PRESETS[1].label })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("sauvegarde immédiatement au clic sur une couleur, sans bouton Enregistrer", async () => {
    render(<BrandColorPicker brandColor={BRAND_PRESETS[0].value} />);

    await userEvent.click(screen.getByRole("button", { name: BRAND_PRESETS[1].label }));

    expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({
      brandColor: BRAND_PRESETS[1].value,
    });
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("affiche une erreur si la sauvegarde échoue", async () => {
    updateTenantSettingsActionMock.mockRejectedValue(new Error("Échec réseau"));
    render(<BrandColorPicker brandColor={BRAND_PRESETS[0].value} />);

    await userEvent.click(screen.getByRole("button", { name: BRAND_PRESETS[1].label }));

    expect(await screen.findByText("Échec réseau")).toBeInTheDocument();
  });
});
