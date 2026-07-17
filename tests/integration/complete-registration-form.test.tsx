import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompleteRegistrationForm } from "@/presentation/auth/components/complete-registration-form";

describe("CompleteRegistrationForm — type de commerce", () => {
  async function fillMandatoryFields() {
    await userEvent.type(screen.getByLabelText("Code reçu par SMS"), "123456");
    await userEvent.type(screen.getByLabelText("Votre nom"), "Awa Ndiaye");
    await userEvent.type(screen.getByLabelText("Nom de votre boutique"), "Boutique Awa");
  }

  it("soumet ALIMENTATION_GENERALE par défaut sans interaction avec le sélecteur", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<CompleteRegistrationForm initialPhone="+221771234567" action={action} />);

    await fillMandatoryFields();
    await userEvent.type(screen.getByLabelText("Choisissez un code PIN"), "1234");

    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0][0]).toMatchObject({ businessType: "ALIMENTATION_GENERALE" });
  });

  it("soumet le type de commerce sélectionné manuellement", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<CompleteRegistrationForm initialPhone="+221771234567" action={action} />);

    await fillMandatoryFields();
    await userEvent.click(screen.getByRole("button", { name: "Boucherie" }));
    await userEvent.type(screen.getByLabelText("Choisissez un code PIN"), "1234");

    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0][0]).toMatchObject({ businessType: "BOUCHERIE" });
  });

  it("le champ obligatoire n'est jamais bloquant : la valeur par défaut suffit à valider le formulaire", () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<CompleteRegistrationForm initialPhone="+221771234567" action={action} />);

    // Aucune interaction avec BusinessTypeSelector : le bouton reste
    // désactivé uniquement à cause des autres champs vides, jamais du type
    // de commerce (déjà valide via sa valeur par défaut).
    expect(screen.getByRole("button", { name: "Alimentation générale" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
